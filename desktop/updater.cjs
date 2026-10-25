const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const RELEASE_API = "https://api.github.com/repos/natanai/pre-programmed/releases/latest";
const ASSET_LIMIT = 600 * 1024 * 1024;
const USER_AGENT = "Pre-Programmed-Windows-Portability";
function semverParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  return match ? match.slice(1).map(Number) : null;
}
function isNewerVersion(candidate, installed) {
  const left = semverParts(candidate), right = semverParts(installed);
  if (!left || !right) return false;
  for (let i = 0; i < 3; i++) {
    if (left[i] > right[i]) return true;
    if (left[i] < right[i]) return false;
  }
  return false;
}
function selectRelease(release, currentVersion) {
  if (!release || release.draft || release.prerelease || !isNewerVersion(release.tag_name, currentVersion)) return null;
  const version = release.tag_name.slice(1);
  const name = "Pre-Programmed-v" + version + "-windows-x64.zip";
  const asset = release.assets?.find((item) => item.name === name);
  if (!asset || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > ASSET_LIMIT) {
    throw new Error("The new release does not include a compatible Windows ZIP.");
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(asset.digest ?? "")) {
    throw new Error("The new release has no verifiable SHA-256 digest.");
  }
  const expectedUrl = "https://github.com/natanai/pre-programmed/releases/download/v" + version + "/" + name;
  if (asset.browser_download_url !== expectedUrl) {
    throw new Error("The Windows asset did not come from the official GitHub release.");
  }
  return { version, asset };
}
async function findUpdate(currentVersion) {
  const response = await fetch(RELEASE_API, {
    headers: { "user-agent": USER_AGENT, accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error("GitHub release check failed (" + response.status + ").");
  return selectRelease(await response.json(), currentVersion);
}
function powershell(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args], {
      windowsHide: true, stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Windows ZIP extraction failed (" + code + ").")));
  });
}
async function downloadZip(asset, destination, progress) {
  const response = await fetch(asset.browser_download_url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok || !response.body) throw new Error("The release download failed (" + response.status + ").");
  let received = 0;
  const hash = createHash("sha256");
  const chunks = Readable.fromWeb(response.body).map((chunk) => {
    received += chunk.byteLength;
    if (received > ASSET_LIMIT) throw new Error("Release download exceeded the maximum allowed size.");
    hash.update(chunk);
    progress?.(received, asset.size);
    return chunk;
  });
  await pipeline(chunks, fs.createWriteStream(destination, { flags: "wx" }));
  if (received !== asset.size || ("sha256:" + hash.digest("hex")).toLowerCase() !== asset.digest.toLowerCase()) {
    throw new Error("The release ZIP failed integrity verification. No files were changed.");
  }
}
async function stageUpdate({ release, root, scriptSource, onProgress }) {
  const next = path.join(root, "_engine.next");
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "pre-programmed-update-"));
  try {
    if (fs.existsSync(next) || fs.existsSync(path.join(root, "_engine.previous"))) {
      throw new Error("An earlier update is incomplete. Inspect _engine.next or _engine.previous before updating.");
    }
    const zip = path.join(tmp, "release.zip");
    await downloadZip(release.asset, zip, onProgress);
    const expanded = path.join(tmp, "unpacked");
    const psLiteral = (value) => "\'" + value.replace(/\'/g, "\'\'") + "\'";
    await powershell(["-Command", "Expand-Archive -LiteralPath " + psLiteral(zip) + " -DestinationPath " + psLiteral(expanded) + " -Force"]);
    const stageRoot = path.join(expanded, "Pre-Programmed");
    const engine = path.join(stageRoot, "_engine");
    for (const required of [
      path.join(stageRoot, "installation.txt"),
      path.join(engine, "Pre-Programmed.exe"),
      path.join(engine, "resources"),
    ]) {
      if (!fs.existsSync(required)) throw new Error("The new ZIP has an unexpected installation layout.");
    }
    if (fs.existsSync(path.join(engine, "data"))) throw new Error("The downloaded runtime unexpectedly contains saved game data.");
    await fsp.cp(engine, next, { recursive: true, errorOnExist: true, force: false });
    const scriptFile = path.join(tmp, "apply-update.ps1");
    await fsp.copyFile(scriptSource, scriptFile);
    await fsp.rm(path.join(tmp, "unpacked"), { recursive: true, force: true });
    await fsp.rm(zip, { force: true });
    return { next, tmp, scriptFile };
  } catch (error) {
    await fsp.rm(next, { recursive: true, force: true }).catch(() => {});
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
function applyAfterExit({ root, tmp, scriptFile, parentPid }) {
  const child = spawn("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptFile,
    "-Root", root, "-OldPid", String(parentPid), "-TempRoot", tmp,
  ], { detached: true, windowsHide: true, stdio: "ignore" });
  child.unref();
  return child;
}
module.exports = { isNewerVersion, selectRelease, findUpdate, stageUpdate, applyAfterExit };
