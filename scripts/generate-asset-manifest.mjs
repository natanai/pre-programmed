import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const ASSET_ROOT = new URL("../public/assets/", import.meta.url);
const EXTENSIONS = new Set([".png", ".webp", ".gif", ".svg", ".mp3", ".wav", ".ogg"]);

async function walk(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const path = join(directory.pathname, entry.name);
      return entry.isDirectory() ? walk(new URL(`file://${path}/`)) : [path];
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
    if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) return { width: Math.abs(viewBox[2]), height: Math.abs(viewBox[3]) };
    const width = Number.parseFloat(text.match(/\bwidth=["']([^"']+)["']/i)?.[1] ?? "");
    const height = Number.parseFloat(text.match(/\bheight=["']([^"']+)["']/i)?.[1] ?? "");
    if (Number.isFinite(width) && Number.isFinite(height)) return { width, height };
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

async function readIdentity(path) {
  const sidecarPath = `${path}.asset.json`;
  let text;
  try {
    text = await readFile(sidecarPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Repository asset ${relative(ASSET_ROOT.pathname, path)} is missing ${relative(ASSET_ROOT.pathname, sidecarPath)}. Every shipped asset needs a stable identity sidecar.`);
    }
    throw error;
  }
  let value;
  try { value = JSON.parse(text); } catch (error) { throw new Error(`Invalid asset sidecar ${sidecarPath}.`, { cause: error }); }
  if (!value || typeof value.id !== "string" || !value.id.trim()) throw new Error(`Asset sidecar ${sidecarPath} needs a stable id.`);
  if (value.defaultPresentation !== undefined && !["inline", "overlay"].includes(value.defaultPresentation)) throw new Error(`Asset sidecar ${sidecarPath} has an invalid defaultPresentation.`);
  return { ...value, authoringMode: normalizeAuthoringMode(value.authoringMode, sidecarPath) };
}

const files = (await walk(ASSET_ROOT)).filter((path) => EXTENSIONS.has(extname(path).toLowerCase()));
const assets = [];
const ids = new Set();

for (const path of files.sort()) {
  const bytes = await readFile(path);
  const extension = extname(path).toLowerCase();
  const assetPath = relative(ASSET_ROOT.pathname, path).split(sep).join("/");
  const source = await stat(path);
  const identity = await readIdentity(path);
  if (ids.has(identity.id)) throw new Error(`Duplicate repository asset id ${identity.id}.`);
  ids.add(identity.id);
  assets.push({
    id: identity.id,
    name: typeof identity.name === "string" && identity.name.trim() ? identity.name.trim() : assetPath.split("/").at(-1),
    path: `public/assets/${assetPath}`,
    runtimePath: `/assets/${assetPath}`,
    type: typeFor(extension),
    mimeType: mimeTypeFor(extension),
    byteLength: source.size,
    hash: createHash("sha256").update(bytes).digest("hex"),
    dimensions: imageDimensions(bytes, extension),
    defaultPresentation: identity.defaultPresentation ?? "overlay",
    authoringMode: identity.authoringMode,
  });
}

const output = `// Generated by scripts/generate-asset-manifest.mjs. Do not hand-edit.\n` +
  `export type AssetManifestEntry = { id: string; name: string; path: string; runtimePath: string; type: "image" | "audio"; mimeType: string; byteLength: number; hash: string; dimensions: { width: number; height: number } | null; defaultPresentation: "inline" | "overlay"; authoringMode: "file" | "vector-grid" };\n` +
  `export const ASSET_MANIFEST: AssetManifestEntry[] = ${JSON.stringify(assets, null, 2)};\n`;

const outputDirectory = new URL("../src/generated/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await writeFile(new URL("assetManifest.ts", outputDirectory), output);
