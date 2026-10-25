const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { createServer } = require("node:http");
const { mkdir, readFile, stat, unlink, writeFile } = require("node:fs/promises");
const { createReadStream, existsSync, mkdirSync, renameSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { projectPathFromArguments } = require("./project-drop.cjs");
const { findUpdate, stageUpdate, applyAfterExit } = require("./updater.cjs");

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
const DEFAULT_START_BUTTON_TEXT = "INITIALIZE UNIVERSE";
const INSTALLATION_FILE = "installation.txt";
let miniflare = null;
let hostServer = null;
let mainWindow = null;
let quitting = false;
let portableHost = null;
let updateInProgress = false;
let projectImportQueue = Promise.resolve();
const waitingProjectFiles = [];

function portableRoot() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return path.resolve(process.env.PORTABLE_EXECUTABLE_DIR);
  if (app.isPackaged) {
    const executableDir = path.dirname(process.execPath);
    if (path.basename(executableDir).toLowerCase() === "_engine") return path.dirname(executableDir);
    return executableDir;
  }
  return path.resolve(__dirname, "portable-dev");
}

function migrateLegacyPortableData(root) {
  const legacyData = path.join(root, "data");
  const containedData = path.join(root, "_engine", "data");
  if (!existsSync(legacyData) || existsSync(containedData)) return;
  mkdirSync(path.dirname(containedData), { recursive: true });
  renameSync(legacyData, containedData);
}

function configurePortableElectronPaths() {
  const root = portableRoot();
  migrateLegacyPortableData(root);
  const electronRoot = path.join(root, "_engine", "data", "electron");
  const paths = {
    userData: path.join(electronRoot, "user-data"),
    sessionData: path.join(electronRoot, "session-data"),
    cache: path.join(electronRoot, "cache"),
    crashDumps: path.join(electronRoot, "crash-dumps"),
    logs: path.join(electronRoot, "logs"),
    temp: path.join(electronRoot, "temp"),
  };
  for (const target of Object.values(paths)) mkdirSync(target, { recursive: true });
  for (const [name, target] of Object.entries(paths)) app.setPath(name, target);
  return root;
}

const configuredPortableRoot = configurePortableElectronPaths();

function assertPortableElectronPaths(root) {
  const resolvedRoot = path.resolve(root);
  for (const name of ["userData", "sessionData", "cache", "crashDumps", "logs", "temp"]) {
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
      return { authorKey: DEFAULT_AUTHOR_KEY, startButtonText: DEFAULT_START_BUTTON_TEXT };
    }
    throw error;
  }

  let authorKey = "";
  let startButtonText = DEFAULT_START_BUTTON_TEXT;
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
    } else if (name === "START_BUTTON_TEXT") {
      if (!value) throw new Error(`${INSTALLATION_FILE} has an empty START_BUTTON_TEXT.`);
      startButtonText = value;
    }
  }
  if (!authorKey) throw new Error(`${INSTALLATION_FILE} must contain an AUTHOR_KEY=... line.`);
  return { authorKey, startButtonText };
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
  const dataRoot = path.join(root, "_engine", "data");
  const assetRoot = path.join(root, "assets");
  await Promise.all([
    mkdir(dataRoot, { recursive: true }),
    mkdir(assetRoot, { recursive: true }),
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
  const installationScript = `<script>window.__PRE_PROGRAMMED_INSTALLATION__=${JSON.stringify({ startButtonText: installation.startButtonText }).replace(/</g, "\\u003c")};</script>`;
  const injectedScripts = `${manifestScript}${installationScript}`;
  const indexHtml = indexTemplate.includes("</head>")
    ? indexTemplate.replace("</head>", `${injectedScripts}</head>`)
    : `${injectedScripts}${indexTemplate}`;

  hostServer = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        await proxyApi(request, response);
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
    startButtonText: installation.startButtonText,
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
  const { url, assetWarning, authorKey, startButtonText } = await startLocalHost();
  if (assetWarning) throw new Error(`Portable asset scan failed: ${assetWarning}`);

  const indexResponse = await fetch(url, { cache: "no-store" });
  const indexText = await indexResponse.text();
  if (!indexResponse.ok || !indexText.includes("__PRE_PROGRAMMED_PORTABLE_ASSETS__")) {
    throw new Error("Portable client did not load through the local host.");
  }
  const expectedInstallationScript = `window.__PRE_PROGRAMMED_INSTALLATION__=${JSON.stringify({ startButtonText }).replace(/</g, "\\u003c")};`;
  if (!indexText.includes(expectedInstallationScript)) {
    throw new Error("Portable installation start-button text contract failed.");
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
  if (!exportResponse.ok || exported?.format !== "pre-programmed-project"
    || !Number.isInteger(exported?.version) || exported.version < 3
    || !exported.project || typeof exported.project !== "object" || Array.isArray(exported.project)
    || "revision" in exported.project
    || !Number.isInteger(exported?.sourceSchemaVersion)
    || !exported.featureData || typeof exported.featureData !== "object" || Array.isArray(exported.featureData)
    || "bookmarks" in exported) {
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

  // Exercise the real Windows-contained Worker persistence boundary using
  // older portable Character data, not just an empty project import.
  const oldProject = structuredClone(exported);
  oldProject.project.entities = [
    ...(oldProject.project.entities ?? []).filter((entity) => entity.id !== "portable-self-test-character"),
    {
      id: "portable-self-test-character",
      key: "rose",
      type: "character",
      name: "Rose",
      aliases: ["Rosie", "Ro"], // Old exports stored plain strings.
      description: "",
      tags: [],
      interactable: false,
      operations: [],
      hooks: [],
      portraitAssetId: null,
    },
  ];
  const importOldResponse = await fetch(new URL("api/author/project/import", url), {
    method: "POST",
    headers: { authorization: `Bearer ${login.token}`, "content-type": "application/json" },
    body: JSON.stringify(oldProject),
  });
  const importedOld = await importOldResponse.json();
  const oldCharacter = importedOld?.snapshot?.entities?.find(
    (entity) => entity.id === "portable-self-test-character",
  );
  if (!importOldResponse.ok || JSON.stringify(oldCharacter?.aliases) !== JSON.stringify(["Rosie", "Ro"])) {
    throw new Error(`Older Character alias import failed: ${JSON.stringify(importedOld)}`);
  }

  const updatedCharacter = {
    ...oldCharacter,
    aliases: [
      { name: "Rosie", condition: { type: "always" } },
      { name: "Sweetheart" },
    ],
    startingNameSelection: "first",
  };
  const editResponse = await fetch(new URL("api/author/mutate", url), {
    method: "POST",
    headers: { authorization: `Bearer ${login.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      expectedRevision: importedOld.snapshot.revision,
      description: "Edit imported Character aliases",
      operations: [{ type: "entity.upsert", entity: updatedCharacter }],
    }),
  });
  const edited = await editResponse.json();
  const editedCharacter = edited?.snapshot?.entities?.find(
    (entity) => entity.id === "portable-self-test-character",
  );
  if (!editResponse.ok || editedCharacter?.aliases?.[0]?.condition?.type !== "always"
    || editedCharacter?.aliases?.[1]?.name !== "Sweetheart"
    || editedCharacter?.startingNameSelection !== "first") {
    throw new Error(`Imported Character alias edit/save failed: ${JSON.stringify(edited)}`);
  }

  const reexportResponse = await fetch(new URL("api/author/project/export", url), {
    headers: { authorization: `Bearer ${login.token}` }, cache: "no-store",
  });
  const reexported = await reexportResponse.json();
  const exportedCharacter = reexported?.project?.entities?.find(
    (entity) => entity.id === "portable-self-test-character",
  );
  if (!reexportResponse.ok || exportedCharacter?.aliases?.[0]?.condition?.type !== "always"
    || exportedCharacter?.aliases?.[1]?.name !== "Sweetheart") {
    throw new Error("Edited Character aliases were not retained by .ppgame export.");
  }
  const reimportResponse = await fetch(new URL("api/author/project/import", url), {
    method: "POST",
    headers: { authorization: `Bearer ${login.token}`, "content-type": "application/json" },
    body: JSON.stringify(reexported),
  });
  const reimported = await reimportResponse.json();
  if (!reimportResponse.ok || reimported?.snapshot?.entities?.find(
    (entity) => entity.id === "portable-self-test-character",
  )?.aliases?.[0]?.condition?.type !== "always") {
    throw new Error("Edited Character aliases did not survive a second project import.");
  }


  // Exercise the same dropped-project import and backup path as Windows Explorer.
  const dropFixture = path.join(configuredPortableRoot, "_engine", "data", "drop-self-test.ppgame");
  await writeFile(dropFixture, JSON.stringify(reexported), "utf8");
  try {
    if (projectPathFromArguments([process.execPath, dropFixture]) !== dropFixture) {
      throw new Error("Windows .ppgame drop argument was not recognized.");
    }
    const importedByDrop = await importProjectFile(dropFixture, { url, authorKey });
    const backup = JSON.parse(await readFile(importedByDrop.backupFile, "utf8"));
    if (backup.format !== "pre-programmed-project"
      || !Number.isInteger(importedByDrop.snapshot.revision)
      || importedByDrop.snapshot.revision <= reimported.snapshot.revision) {
      throw new Error("Dropped .ppgame import/backup did not complete through the canonical Worker.");
    }
  } finally {
    await unlink(dropFixture);
  }

  await shutdown();
}


/**
 * Use the canonical Author project import/export endpoints for .ppgame drops.
 * Existing authored game data is backed up before any replacement.
 */
async function importProjectFile(filename, { url, authorKey }) {
  const fileText = await readFile(filename, "utf8");
  let document;
  try {
    document = JSON.parse(fileText);
  } catch {
    throw new Error("The dropped .ppgame file is not valid JSON.");
  }
  if (!document || document.format !== "pre-programmed-project" || !Number.isInteger(document.version)) {
    throw new Error("This file is not a Pre-Programmed .ppgame project.");
  }

  const loginResponse = await fetch(new URL("api/author/login", url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: authorKey }),
  });
  const login = await loginResponse.json();
  if (!loginResponse.ok || typeof login?.token !== "string") {
    throw new Error("Could not authorize the local project import.");
  }
  const headers = { authorization: "Bearer " + login.token };
  const exportResponse = await fetch(new URL("api/author/project/export", url), {
    headers,
    cache: "no-store",
  });
  if (!exportResponse.ok) {
    throw new Error("Could not back up the currently loaded project; import was cancelled.");
  }
  const existingProject = await exportResponse.text();
  const backupDirectory = path.join(configuredPortableRoot, "_engine", "data", "backups");
  await mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDirectory, "before-import-" + timestamp + "-" + randomUUID().slice(0, 8) + ".ppgame");
  await writeFile(backupFile, existingProject, { encoding: "utf8", flag: "wx" });

  const importResponse = await fetch(new URL("api/author/project/import", url), {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: fileText,
  });
  const result = await importResponse.json().catch(() => null);
  if (!importResponse.ok || !Number.isInteger(result?.snapshot?.revision)) {
    throw new Error(result?.error || "The project could not be imported. Your existing project has not been replaced.");
  }
  return { backupFile, snapshot: result.snapshot };
}

function queueDroppedProject(filename) {
  projectImportQueue = projectImportQueue.then(async () => {
    if (!mainWindow || !portableHost) {
      waitingProjectFiles.push(filename);
      return;
    }
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Load a .ppgame project?",
      message: "Load " + path.basename(filename) + "?",
      detail: "This replaces the currently authored game in this installation. Pre-Programmed will save a .ppgame backup of your current game first. Ordinary image/audio assets remain in the assets folder.",
      buttons: ["Load game", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (confirmation.response !== 0) return;
    const { backupFile } = await importProjectFile(filename, portableHost);
    await mainWindow.loadURL(portableHost.url);
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Game loaded",
      message: path.basename(filename) + " is now loaded.",
      detail: "The previous project was backed up to:\n" + backupFile,
      buttons: ["OK"],
    });
  }).catch((error) => {
    const detail = error instanceof Error ? error.message : String(error);
    dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Could not load .ppgame",
      message: "Pre-Programmed could not load " + path.basename(filename) + ".",
      detail,
      buttons: ["OK"],
    });
  });
}


async function checkAndInstallUpdate() {
  if (!app.isPackaged || process.platform !== "win32") return { message: "Updates are available in the packaged Windows app only." };
  if (updateInProgress) return { message: "An update is already being prepared." };
  updateInProgress = true;
  try {
    const current = app.getVersion();
    const release = await findUpdate(current);
    if (!release) return { message: "Pre-Programmed " + current + " is already up to date." };
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: "Pre-Programmed update",
      message: "Update from v" + current + " to v" + release.version + "?",
      detail: "Pre-Programmed will download the official Windows release, verify it, and restart automatically. Your game, saves, Author key, and assets will be kept. This requires an internet connection and free disk space.",
      buttons: ["Download and update", "Not now"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (choice.response !== 0) return { message: "Update cancelled." };
    const root = configuredPortableRoot;
    if (mainWindow) mainWindow.setProgressBar(0);
    const staged = await stageUpdate({
      release, root, scriptSource: resourcePath("apply-update.ps1"),
      onProgress: (currentBytes, totalBytes) => {
        if (mainWindow && totalBytes > 0) mainWindow.setProgressBar(Math.max(0, Math.min(1, currentBytes / totalBytes)));
      },
    });
    if (mainWindow) mainWindow.setProgressBar(-1);
    applyAfterExit({ root, ...staged, parentPid: process.pid });
    // The helper waits for the Electron/Miniflare process to close before it
    // replaces the engine and transfers the existing local data directory.
    app.quit();
    return { message: "Installing v" + release.version + " and restarting..." };
  } catch (error) {
    dialog.showErrorBox("Update not installed", error instanceof Error ? error.message : String(error));
    return { message: "Update failed. No existing game files were intentionally replaced." };
  } finally {
    if (mainWindow) mainWindow.setProgressBar(-1);
    updateInProgress = false;
  }
}

ipcMain.handle("pre-programmed:app-version", () => app.getVersion());
ipcMain.handle("pre-programmed:check-for-updates", () => checkAndInstallUpdate());

function installSaveAsDownloads(window) {
  window.webContents.session.on("will-download", (_event, item) => {
    const suggestedName = item.getFilename() || "pre-programmed-export";
    // Electron owns the one native Save As dialog. Deferring setSavePath until
    // after a second showSaveDialog raced Electron's own default download prompt.
    // Configure that native prompt synchronously and let Electron handle cancel,
    // chosen destination and download completion through its usual path.
    item.setSaveDialogOptions({
      title: "Save file",
      defaultPath: path.join(app.getPath("downloads"), suggestedName),
      buttonLabel: "Save",
    });
  });
}

async function createWindow() {
  portableHost = await startLocalHost();
  const { url, assetWarning } = portableHost;
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
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  installSaveAsDownloads(mainWindow);
  await mainWindow.loadURL(url);
  if (assetWarning) {
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Asset folder needs attention",
      message: "Pre-Programmed started, but one or more files in assets could not be indexed.",
      detail: assetWarning,
    });
  }
  for (const project of waitingProjectFiles.splice(0)) queueDroppedProject(project);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv, workingDirectory) => {
    const droppedProject = projectPathFromArguments(argv, workingDirectory || process.cwd());
    if (droppedProject) {
      if (mainWindow && portableHost) queueDroppedProject(droppedProject);
      else waitingProjectFiles.push(droppedProject);
    }
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
    const initialProject = projectPathFromArguments(process.argv);
    if (initialProject) queueDroppedProject(initialProject);
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
