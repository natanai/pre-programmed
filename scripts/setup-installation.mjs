import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const force = process.argv.includes("--force");
const newInstallation = process.argv.includes("--new-installation");
const templatePath = new URL("../wrangler.template.jsonc", import.meta.url);
const wranglerPath = new URL("../wrangler.jsonc", import.meta.url);
const envPath = new URL("../.env.local", import.meta.url);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const upstreamRepository = "natanai/pre-programmed";

function parseJsonConfig(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is expected to remain JSON-compatible JSONC for the setup helper.`, { cause: error });
  }
}

async function readExistingWrangler() {
  try {
    return parseJsonConfig(await readFile(wranglerPath, "utf8"), "wrangler.jsonc");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function repositoryFromRemote(remote) {
  const value = remote.trim().replace(/\.git$/, "");
  const ssh = value.match(/^git@github\.com:([^/]+\/[^/]+)$/i);
  if (ssh) return ssh[1].toLowerCase();
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "github.com") return "";
    return url.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  } catch {
    return "";
  }
}

async function readOriginRepository() {
  return await new Promise((resolve) => {
    execFile("git", ["remote", "get-url", "origin"], { cwd: repoRoot }, (error, stdout) => {
      resolve(error ? "" : repositoryFromRemote(stdout));
    });
  });
}

const [existing, originRepository] = await Promise.all([
  readExistingWrangler(),
  readOriginRepository(),
]);
const configuredD1 = existing?.d1_databases?.some((binding) => binding?.database_id || binding?.database_name);
const inheritedUpstreamConfiguration = Boolean(
  configuredD1
  && originRepository
  && originRepository !== upstreamRepository
  && existing?.name === "pre-programmed",
);
const upstreamConfiguredCheckout = Boolean(
  configuredD1
  && originRepository === upstreamRepository
  && existing?.name === "pre-programmed",
);
const replacingKnownUpstreamConfiguration = inheritedUpstreamConfiguration
  || (upstreamConfiguredCheckout && newInstallation);

if (configuredD1 && !force && !replacingKnownUpstreamConfiguration) {
  if (upstreamConfiguredCheckout) {
    console.error([
      "This checkout contains the upstream production D1 configuration.",
      "If this is a NEW CLONE that should become a separate game installation, rerun:",
      "  npm run setup:installation -- --new-installation",
      "If this is the existing production checkout, stop here so its D1 identity is preserved.",
    ].join("\n"));
  } else {
    console.error([
      "This checkout already has an installation-specific D1 configuration.",
      "Setup stopped rather than overwriting it.",
      "Use `npm run setup:installation -- --force` only when replacing this installation is intentional.",
    ].join("\n"));
  }
  process.exit(2);
}

if (inheritedUpstreamConfiguration) {
  console.log("Detected the upstream installation configuration inherited by this fork; replacing it with new installation settings.");
}
if (upstreamConfiguredCheckout && newInstallation) {
  console.log("Treating this upstream clone as a new installation; the inherited production configuration will be replaced locally.");
}

const template = parseJsonConfig(await readFile(templatePath, "utf8"), "wrangler.template.jsonc");
const interactive = Boolean(input.isTTY && output.isTTY);
const rl = interactive ? createInterface({ input, output }) : null;
const inferredRepositoryName = originRepository.split("/").at(-1) || "pre-programmed";

async function answer(envName, prompt, fallback = "") {
  const configured = process.env[envName]?.trim();
  if (configured) return configured;
  if (!rl) return fallback;
  const response = (await rl.question(`${prompt}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  return response || fallback;
}

try {
  const workerName = await answer("PRE_PROGRAMMED_WORKER_NAME", "Worker name", `my-${inferredRepositoryName}`);
  const databaseName = await answer("PRE_PROGRAMMED_D1_DATABASE_NAME", "D1 database name", `${workerName}-db`);
  const apiOrigin = await answer("PRE_PROGRAMMED_API_ORIGIN", "Hosted Worker origin (optional until first deploy)", "");
  const repositoryName = await answer("PRE_PROGRAMMED_REPOSITORY_NAME", "GitHub repository name", inferredRepositoryName);
  const basePath = await answer("PRE_PROGRAMMED_BASE_PATH", "Pages base path", `/${repositoryName}/`);

  template.name = workerName;
  await writeFile(wranglerPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

  const normalizedBasePath = `${basePath.startsWith("/") ? basePath : `/${basePath}`}${basePath.endsWith("/") ? "" : "/"}`;
  const envLines = [
    "# Generated by npm run setup:installation",
    apiOrigin ? `VITE_API_ORIGIN=${apiOrigin.replace(/\/+$/, "")}` : "# VITE_API_ORIGIN=https://your-worker.your-subdomain.workers.dev",
    `VITE_BASE_PATH=${normalizedBasePath}`,
    "",
  ];
  await writeFile(envPath, envLines.join("\n"), "utf8");

  const databaseArgument = JSON.stringify(databaseName);
  console.log([
    "Installation files prepared.",
    `Worker: ${workerName}`,
    `D1 to create: ${databaseName}`,
    `Pages base: ${normalizedBasePath}`,
    "",
    "Next:",
    "1. Authenticate Wrangler with the Cloudflare account that should own this game.",
    `2. Create and persist this installation's D1 binding: npx wrangler d1 create ${databaseArgument} --binding DB --update-config`,
    "   Wrangler should add database_name and database_id to wrangler.jsonc.",
    "3. Configure ADMIN_KEY for the Worker/deployment.",
    "4. Run `npx wrangler deploy`.",
    "5. Set PRE_PROGRAMMED_API_ORIGIN / VITE_API_ORIGIN once the Worker URL is known.",
  ].join("\n"));
} finally {
  rl?.close();
}
