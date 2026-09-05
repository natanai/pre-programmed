const { app, BrowserWindow, dialog } = require("electron");
const { createServer } = require("node:http");
const { mkdir, readFile, stat } = require("node:fs/promises");
const { createReadStream, mkdirSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const DEFAULT_AUTHOR_KEY = "local";
const INSTALLATION_FILE = "installation.txt";
let miniflare = null;
let hostServer = null;
let mainWindow = null;
let quitting = false;

function portableRoot() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return path.resolve(process.env.PORTABLE_EXECUTABLE_DIR);
  if (app.isPackaged) return path.dirname(process.execPath);
  return path.resolve(__dirname, "portable-dev");
}

function configurePortableElectronPaths() {
  const root = portableRoot();
  const electronRoot = path.join(root, "data", "electron");
  const paths = {
    userData: path.join(electronRoot, "user-data"),
    sessionData: path.join(electronRoot, "session-data"),
    cache: path.join(electronRoot, "cache"),
    crashDumps: path.join(electronRoot, "crash-dumps"),
    logs: path.join(electronRoot, "logs"),
    temp: path.join(electronRoot, "temp"),
    downloads: path.join(root, "exports"),
  };
  for (const target of Object.values(paths)) mkdirSync(target, { recursive: true });
  for (const [name, target] of Object.entries(paths)) app.setPath(name, target);
  return root;
}

const configuredPortableRoot = configurePortableElectronPaths();

function assertPortableElectronPaths(root) {
  const resolvedRoot = path.resolve(root);
  for (const name of ["userData", "sessionData", "cache", "crashDumps", "logs", "temp", "downloads"]) {
    const configured = path.resolve(app.getPath(name));
    if (configured !== resolvedRoot && !configured.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error(`Electron path ${name} escaped the portable folder: ${configured}`);
    }
  }
}

function resourcePath(name) {
  return app.isPackaged ? path.join(process.resourcesPath, name) : path.resolve(__dirname, name);
}

function safeFile(root, pathname) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname).replace(/^[/\\]+/, "");
  } catch {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relativePath);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) return null;
  return candidate;
}

async function existingFile(candidate) {
  if (!candidate) return null;
  try {
    const source = await stat(candidate);
    return source.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

async function readInstallationSettings(root) {
  const filename = path.join(root, INSTALLATION_FILE);
  let text;
  try {
    text = await readFile(filename, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { authorKey: DEFAULT_AUTHOR_KEY, initializeUniverseText: undefined };
    }
    throw error;
  }

  let authorKey = "";
  let initializeUniverseText;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toUpperCase();
    const value = line.slice(separator + 1).trim();
    if (name === "AUTHOR_KEY") {
      if (!value) throw new Error(`${INSTALLATION_FILE} has an empty AUTHOR_KEY.`);
      authorKey = value;
    } else if (name === "INITIALIZE_UNIVERSE_TEXT") {
      initializeUniverseText = value;
    }
  }
  if (!authorKey) throw new Error(`${INSTALLATION_FILE} must contain an AUTHOR_KEY=... line.`);
  return { authorKey, initializeUniverseText };
}

function sendFile(response, filename) {
  response.statusCode = 200;
  response.setHeader("content-type", CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream");
  response.setHeader("cache-control", "no-store");
  createReadStream(filename).pipe(response);
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyApi(request, response) {
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await requestBody(request);
  const upstream = await miniflare.dispatchFetch(`http://terminal.local${request.url}`, {
    method: request.method,
    headers: request.headers,
    body,
  });
  response.statusCode = upstream.status;
  for (const [name, value] of upstream.headers) {
    const normalized = name.toLowerCase();
    if (normalized === "content-length" || normalized === "transfer-encoding" || normalized === "connection") continue;
    response.setHeader(name, value);
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  response.setHeader("content-length", String(bytes.length));
  response.end(bytes);
}

async function startLocalHost() {
  const root = configuredPortableRoot;
  const dataRoot = path.join(root, "data");
  const assetRoot = path.join(root, "assets");
  const exportRoot = path.join(root, "exports");
  await Promise.all([
    mkdir(dataRoot, { recursive: true }),
    mkdir(assetRoot, { recursive: true }),
    mkdir(exportRoot, { recursive: true }),
  ]);
  const installation = await readInstallationSettings(root);
  const authorKey = installation.authorKey;

  const workerScript = await readFile(resourcePath("worker.mjs"), "utf8");
  const { Miniflare, convertV4MiniflareOptions } = await import("miniflare");
  miniflare = new Miniflare(convertV4MiniflareOptions({
    host: "127.0.0.1",
    port: 0,
    modules: true,
    script: workerScript,
    compatibilityDate: "2026-08-30",
    bindings: { ADMIN_KEY: authorKey },
    d1Databases: { DB: "11111111-1111-4111-8111-111111111111" },
    resourcePersistencePath: dataRoot,
  }));
  await miniflare.ready;

  let portableAssets = [];
  let assetWarning = "";
  try {
    const scannerModule = await import(pathToFileURL(resourcePath("asset-manifest-lib.mjs")).href);
    portableAssets = await scannerModule.scanAssetDirectory(assetRoot, {
      logicalPathPrefix: "assets",
      runtimePathPrefix: "/assets",
    });
  } catch (error) {
    assetWarning = error instanceof Error ? error.message : String(error);
  }

  const clientRoot = resourcePath("client");
  const indexPath = path.join(clientRoot, "index.html");
  const indexTemplate = await readFile(indexPath, "utf8");
  const manifestScript = `<script>window.__PRE_PROGRAMMED_PORTABLE_ASSETS__=${JSON.stringify(portableAssets).replace(/</g, "\\u003c")};</script>`;
  const indexHtml = indexTemplate.includes("</head>")
    ? indexTemplate.replace("</head>", `${manifestScript}</head>`)
    : `${manifestScript}${indexTemplate}`;

  hostServer = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        await proxyApi(request, response);
        return;
      }

      if (url.pathname === "/engine-text.txt" && typeof installation.initializeUniverseText === "string") {
        const text = `# Pre-Programmed portable installation-owned player text\nINITIALIZE_UNIVERSE_TEXT=${installation.initializeUniverseText}\n`;
        const bytes = Buffer.from(text, "utf8");
        response.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
          "content-length": String(bytes.length),
          "cache-control": "no-store",
        });
        response.end(bytes);
        return;
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        const bytes = Buffer.from(indexHtml, "utf8");
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-length": String(bytes.length),
          "cache-control": "no-store",
        });
        response.end(bytes);
        return;
      }

      if (url.pathname.startsWith("/assets/")) {
        const external = await existingFile(safeFile(assetRoot, url.pathname.slice("/assets/".length)));
        if (external) {
          sendFile(response, external);
          return;
        }
      }

      const bundled = await existingFile(safeFile(clientRoot, url.pathname));
      if (bundled) {
        sendFile(response, bundled);
        return;
      }

      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    } catch (error) {
      console.error("Portable host request failed", error);
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Local engine request failed.");
    }
  });

  await new Promise((resolve, reject) => {
    hostServer.once("error", reject);
    hostServer.listen(0, "127.0.0.1", resolve);
  });
  const address = hostServer.address();
  if (!address || typeof address === "string") throw new Error("Portable host did not acquire a local port.");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    assetWarning,
    authorKey,
    initializeUniverseText: installation.initializeUniverseText,
  };
}

async function shutdown() {
  if (quitting) return;
  quitting = true;
  if (hostServer) {
    await new Promise((resolve) => hostServer.close(() => resolve()));
    hostServer = null;
  }
  if (miniflare) {
    await miniflare.dispose();
    miniflare = null;
  }
}

async function runSelfTest() {
  assertPortableElectronPaths(configuredPortableRoot);
  const { url, assetWarning, authorKey, initializeUniverseText } = await startLocalHost();
  if (assetWarning) throw new Error(`Portable asset scan failed: ${assetWarning}`);

  const indexResponse = await fetch(url, { cache: "no-store" });
  const indexText = await indexResponse.text();
  if (!indexResponse.ok || !indexText.includes("__PRE_PROGRAMMED_PORTABLE_ASSETS__")) {
    throw new Error("Portable client did not load through the local host.");
  }

  const engineTextResponse = await fetch(new URL("engine-text.txt", url), { cache: "no-store" });
  const engineText = await engineTextResponse.text();
  if (!engineTextResponse.ok || (typeof initializeUniverseText === "string"
    && !engineText.split(/\r?\n/).includes(`INITIALIZE_UNIVERSE_TEXT=${initializeUniverseText}`))) {
    throw new Error("Portable installation startup text contract failed.");
  }

  const healthResponse = await fetch(new URL("api/health", url), { cache: "no-store" });
  const health = await healthResponse.json();
  if (!healthResponse.ok || health?.ok !== true || health?.authorConfigured !== true
    || health?.mediaGeneratedPersistence !== "d1" || health?.mediaFilePersistence !== "repository") {
    throw new Error("Portable Worker health contract failed.");
  }

  const snapshotResponse = await fetch(new URL("api/project/snapshot", url), { cache: "no-store" });
  const snapshot = await snapshotResponse.json();
  if (!snapshotResponse.ok || typeof snapshot?.revision !== "number" || !Array.isArray(snapshot?.nodes)) {
    throw new Error("Portable D1 project did not initialize.");
  }

  const loginResponse = await fetch(new URL("api/author/login", url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: authorKey }),
  });
  const login = await loginResponse.json();
  if (!loginResponse.ok || typeof login?.token !== "string" || !login.token) {
    throw new Error("Portable Author login failed with installation.txt AUTHOR_KEY.");
  }

  const exportResponse = await fetch(new URL("api/author/project/export", url), {
    headers: { authorization: `Bearer ${login.token}` },
    cache: "no-store",
  });
  const exportedText = await exportResponse.text();
  let exported;
  try {
    exported = JSON.parse(exportedText);
  } catch {
    throw new Error("Portable project export was not valid JSON.");
  }
  if (!exportResponse.ok || exported?.format !== "pre-programmed-project" || exported?.version !== 1
    || typeof exported?.project !== "object" || "revision" in exported.project
    || !Array.isArray(exported?.bookmarks) || typeof exported?.featureData !== "object") {
    throw new Error("Portable project export contract failed.");
  }

  const importResponse = await fetch(new URL("api/author/project/import", url), {
    method: "POST",
    headers: {
      authorization: `Bearer ${login.token}`,
      "content-type": "application/json",
    },
    body: exportedText,
  });
  const imported = await importResponse.json();
  if (!importResponse.ok || typeof imported?.snapshot?.revision !== "number"
    || imported.snapshot.revision <= snapshot.revision || !Array.isArray(imported.snapshot.nodes)) {
    throw new Error("Portable project import round-trip failed.");
  }

  await shutdown();
}

async function createWindow() {
  const { url, assetWarning } = await startLocalHost();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 540,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  await mainWindow.loadURL(url);
  if (assetWarning) {
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Asset folder needs attention",
      message: "Pre-Programmed started, but one or more files in assets could not be indexed.",
      detail: assetWarning,
    });
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.argv.includes("--self-test")) {
      try {
        await runSelfTest();
        app.exit(0);
      } catch (error) {
        console.error(error);
        await shutdown().catch(() => {});
        app.exit(1);
      }
      return;
    }
    await createWindow();
  }).catch((error) => {
    console.error(error);
    dialog.showErrorBox("Pre-Programmed could not start", error instanceof Error ? error.message : String(error));
    app.exit(1);
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    shutdown().finally(() => app.quit());
  });
}
