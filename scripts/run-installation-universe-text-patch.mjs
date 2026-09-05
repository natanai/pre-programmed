import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sourcePath = new URL("./apply-installation-universe-text-v2.mjs", import.meta.url);
const outputPath = new URL("./.apply-installation-universe-text-fixed.mjs", import.meta.url);
let source = readFileSync(sourcePath, "utf8");
source = source.replace(
  'const url = new URL(`${import.meta.env.BASE_URL}engine-text.txt`, window.location.origin);',
  'const url = new URL(import.meta.env.BASE_URL + "engine-text.txt", window.location.origin);',
);
writeFileSync(outputPath, source, "utf8");
await import(pathToFileURL(outputPath.pathname).href);
