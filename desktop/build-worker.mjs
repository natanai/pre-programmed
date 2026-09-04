import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const desktopRoot = fileURLToPath(new URL("./", import.meta.url));
const repositoryRoot = resolve(desktopRoot, "..");
const outputDirectory = resolve(desktopRoot, "build");
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: [resolve(repositoryRoot, "worker/index.ts")],
  outfile: resolve(outputDirectory, "worker.mjs"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  sourcemap: false,
  minify: false,
  logLevel: "info"
});
