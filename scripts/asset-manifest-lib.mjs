import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const EXTENSIONS = new Set([".png", ".webp", ".gif", ".svg", ".mp3", ".wav", ".ogg"]);

async function walk(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }));
    return nested.flat();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function readUInt24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function imageDimensions(bytes, extension) {
  if (extension === ".png" && bytes.length >= 24 && bytes.toString("ascii", 1, 4) === "PNG") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (extension === ".gif" && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (extension === ".webp" && bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const chunkType = bytes.toString("ascii", 12, 16);
    if (chunkType === "VP8X") return { width: readUInt24LE(bytes, 24) + 1, height: readUInt24LE(bytes, 27) + 1 };
    if (chunkType === "VP8L" && bytes[20] === 0x2f) {
      const b0 = bytes[21]; const b1 = bytes[22]; const b2 = bytes[23]; const b3 = bytes[24];
      return { width: 1 + b0 + ((b1 & 0x3f) << 8), height: 1 + ((b1 & 0xc0) >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10) };
    }
    if (chunkType === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
  }
  if (extension === ".svg") {
    const text = bytes.toString("utf8");
    const viewBox = text.match(/\bviewBox=["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/).map(Number);
    if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
      return { width: Math.abs(viewBox[2]), height: Math.abs(viewBox[3]) };
    }
    return null;
  }
  return null;
}

function typeFor(extension) {
  return [".png", ".webp", ".gif", ".svg"].includes(extension) ? "image" : "audio";
}

function mimeTypeFor(extension) {
  return ({
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  })[extension] ?? "application/octet-stream";
}

function normalizeAuthoringMode(value, sidecarPath) {
  if (value === undefined || value === "file") return "file";
  if (value === "vector-grid" || value === "grid32") return "vector-grid";
  throw new Error(`Asset sidecar ${sidecarPath} has an invalid authoringMode.`);
}

async function readIdentity(path, assetRoot) {
  const sidecarPath = `${path}.asset.json`;
  let text;
  try {
    text = await readFile(sidecarPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Asset ${relative(assetRoot, path)} is missing ${relative(assetRoot, sidecarPath)}. Every file asset needs a stable identity sidecar.`);
    }
    throw error;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid asset sidecar ${sidecarPath}.`, { cause: error });
  }
  if (!value || typeof value.id !== "string" || !value.id.trim()) throw new Error(`Asset sidecar ${sidecarPath} needs a stable id.`);
  if (value.defaultPresentation !== undefined && !["inline", "overlay"].includes(value.defaultPresentation)) {
    throw new Error(`Asset sidecar ${sidecarPath} has an invalid defaultPresentation.`);
  }
  return { ...value, id: value.id.trim(), authoringMode: normalizeAuthoringMode(value.authoringMode, sidecarPath) };
}

function joinedPrefix(prefix, assetPath, leadingSlash) {
  const normalized = prefix.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const joined = normalized ? `${normalized}/${assetPath}` : assetPath;
  return leadingSlash ? `/${joined}` : joined;
}

/**
 * Canonical repository-style file Media scanner.
 *
 * Hosted builds call this at build time for public/assets. The portable desktop
 * host calls the same scanner at runtime for the visible assets/ folder beside
 * the executable, so stable Media identity and validation do not fork.
 */
export async function scanAssetDirectory(assetRoot, options = {}) {
  const root = resolve(assetRoot);
  const logicalPathPrefix = options.logicalPathPrefix ?? "public/assets";
  const runtimePathPrefix = options.runtimePathPrefix ?? "/assets";
  const files = (await walk(root)).filter((path) => EXTENSIONS.has(extname(path).toLowerCase()));
  const assets = [];
  const ids = new Set();

  for (const path of files.sort()) {
    const bytes = await readFile(path);
    const extension = extname(path).toLowerCase();
    const assetPath = relative(root, path).split(sep).join("/");
    const source = await stat(path);
    const identity = await readIdentity(path, root);
    if (ids.has(identity.id)) throw new Error(`Duplicate file Media id ${identity.id}.`);
    ids.add(identity.id);
    assets.push({
      id: identity.id,
      name: typeof identity.name === "string" && identity.name.trim() ? identity.name.trim() : assetPath.split("/").at(-1),
      path: joinedPrefix(logicalPathPrefix, assetPath, false),
      runtimePath: joinedPrefix(runtimePathPrefix, assetPath, true),
      type: typeFor(extension),
      mimeType: mimeTypeFor(extension),
      byteLength: source.size,
      hash: createHash("sha256").update(bytes).digest("hex"),
      dimensions: imageDimensions(bytes, extension),
      defaultPresentation: identity.defaultPresentation ?? "overlay",
      authoringMode: identity.authoringMode,
    });
  }

  return assets;
}
