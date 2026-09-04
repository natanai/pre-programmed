import { spawn, spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const dataDirectory = process.env.PRE_PROGRAMMED_LOCAL_DATA_DIR?.trim() || ".wrangler/local-runtime";
const children = new Set();
let closing = false;
let requestedExitCode = 0;

function stopProcessTree(child, force = false) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
  } catch {
    try {
      child.kill(force ? "SIGKILL" : "SIGTERM");
    } catch {}
  }
}

function finishIfStopped() {
  if (closing && children.size === 0) process.exit(requestedExitCode);
}

function launch(args) {
  const child = spawn(npx, args, {
    stdio: "inherit",
    env: process.env,
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!closing) shutdown(code ?? (signal ? 1 : 0));
    else finishIfStopped();
  });
  return child;
}

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  requestedExitCode = code;
  for (const child of children) stopProcessTree(child);
  if (children.size === 0) {
    process.exit(code);
    return;
  }
  const timeout = setTimeout(() => {
    for (const child of children) stopProcessTree(child, true);
    process.exit(requestedExitCode);
  }, 3000);
  timeout.unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log([
  "Pre-Programmed local runtime",
  "Client: http://127.0.0.1:5173",
  "Local API: http://127.0.0.1:8787",
  "Author key: local",
  `Local project data: ${dataDirectory}`,
  "",
  "This local D1 is isolated from any hosted/production database.",
].join("\n"));

launch([
  "wrangler",
  "dev",
  "--config",
  "wrangler.local.jsonc",
  "--port",
  "8787",
  "--persist-to",
  dataDirectory,
]);
launch(["vite", "--host", "127.0.0.1"]);
