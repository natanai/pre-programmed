import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, text) {
  const slash = path.lastIndexOf("/");
  if (slash >= 0) mkdirSync(path.slice(0, slash), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function replaceOnce(path, from, to) {
  const text = read(path);
  if (!text.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 140)}`);
  write(path, text.replace(from, to));
}

function replaceRegexOnce(path, pattern, to) {
  const text = read(path);
  if (!pattern.test(text)) throw new Error(`Pattern not found in ${path}: ${pattern}`);
  pattern.lastIndex = 0;
  write(path, text.replace(pattern, to));
}

write("public/engine-text.txt", `# Pre-Programmed installation-owned player text\n# Edit this plain-text file to change wording that belongs to an installation rather than a .ppgame project.\n# The Windows portable build copies this value into installation.txt beside the local Author password.\n# Leave the value empty to hide the new-game startup caption.\nINITIALIZE_UNIVERSE_TEXT=initialize universe\n`);

write("src/platform/installation/publicSettings.ts", `export type InstallationPublicSettings = {\n  initializeUniverseText: string;\n};\n\nconst DEFAULT_INSTALLATION_TEXT: InstallationPublicSettings = {\n  initializeUniverseText: \"initialize universe\",\n};\n\nexport function parseInstallationPublicText(text: string): InstallationPublicSettings {\n  let initializeUniverseText = DEFAULT_INSTALLATION_TEXT.initializeUniverseText;\n  for (const rawLine of text.split(/\\r?\\n/)) {\n    const line = rawLine.trim();\n    if (!line || line.startsWith(\"#\")) continue;\n    const separator = line.indexOf(\"=\");\n    if (separator < 0) continue;\n    const name = line.slice(0, separator).trim().toUpperCase();\n    if (name === \"INITIALIZE_UNIVERSE_TEXT\") {\n      initializeUniverseText = line.slice(separator + 1).trim();\n    }\n  }\n  return { initializeUniverseText };\n}\n\n/**\n * Read public installation-owned player wording from the current platform.\n * Hosted/local browser builds receive public/engine-text.txt as an ordinary\n * static file. The portable desktop host serves the same URL from its external\n * installation.txt, exposing only public wording and never the Author key.\n */\nexport async function loadInstallationPublicSettings(): Promise<InstallationPublicSettings> {\n  try {\n    const url = new URL(`${import.meta.env.BASE_URL}engine-text.txt`, window.location.origin);\n    const response = await fetch(url, { cache: \"no-store\" });\n    if (!response.ok) return { ...DEFAULT_INSTALLATION_TEXT };\n    return parseInstallationPublicText(await response.text());\n  } catch {\n    return { ...DEFAULT_INSTALLATION_TEXT };\n  }\n}\n`);

replaceOnce(
  "src/App.tsx",
  `import { configuredProjectPersistence } from \"./platform/persistence/configuredProjectPersistence\";`,
  `import { loadInstallationPublicSettings } from \"./platform/installation/publicSettings\";\nimport { configuredProjectPersistence } from \"./platform/persistence/configuredProjectPersistence\";`,
);
replaceOnce(
  "src/App.tsx",
  `  const [activeRadix, setActiveRadix] = useState<ActiveRadixPresentation | null>(null);`,
  `  const [activeRadix, setActiveRadix] = useState<ActiveRadixPresentation | null>(null);\n  const [installationText, setInstallationText] = useState({ ready: false, initializeUniverseText: \"initialize universe\" });`,
);
replaceOnce(
  "src/App.tsx",
  `  useTerminalViewport();\n\n  const currentNode = snapshot && playState`,
  `  useTerminalViewport();\n\n  useEffect(() => {\n    let cancelled = false;\n    void loadInstallationPublicSettings().then((settings) => {\n      if (!cancelled) setInstallationText({ ready: true, initializeUniverseText: settings.initializeUniverseText });\n    });\n    return () => { cancelled = true; };\n  }, []);\n\n  const currentNode = snapshot && playState`,
);
replaceOnce(
  "src/App.tsx",
  `    if (!snapshot || !playState || !playSessionReady || pendingPlaySession || startupRunRef.current) return;`,
  `    if (!snapshot || !playState || !playSessionReady || pendingPlaySession || !installationText.ready || startupRunRef.current) return;`,
);
replaceOnce(
  "src/App.tsx",
  `  }, [snapshot, playState, playSessionReady, pendingPlaySession]);`,
  `  }, [snapshot, playState, playSessionReady, pendingPlaySession, installationText.ready]);`,
);
replaceOnce(
  "src/App.tsx",
  `        sequence={activeRadixSequence}\n        synth={activeRadixSynth}\n        runKey={activeRadix.runKey}`,
  `        sequence={activeRadixSequence}\n        synth={activeRadixSynth}\n        captionOverride={activeRadix.startup ? installationText.initializeUniverseText : undefined}\n        runKey={activeRadix.runKey}`,
);

replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `  sequence: RadixSequenceDefinition;\n  synth?: SynthSound;`,
  `  sequence: RadixSequenceDefinition;\n  synth?: SynthSound;\n  captionOverride?: string;`,
);
replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `  sequence,\n  synth,\n  runtimeSeed,`,
  `  sequence,\n  synth,\n  captionOverride,\n  runtimeSeed,`,
);
replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `  const [awaitingAudioGesture, setAwaitingAudioGesture] = useState(false);`,
  `  const [awaitingAudioGesture, setAwaitingAudioGesture] = useState(false);\n  const caption = captionOverride ?? sequence.caption;`,
);
replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `{sequence.caption ? <div className=\"radix-caption\">{sequence.caption}</div> : null}`,
  `{caption ? <div className=\"radix-caption\">{caption}</div> : null}`,
);

replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `help: \"Player-facing text shown below the visualization. Leave blank for no caption.\"`,
  `help: \"Player-facing text shown below ordinary sequence runs. New-game startup uses installation-owned INITIALIZE_UNIVERSE_TEXT instead.\"`,
);
replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `<p className=\"project-settings-description\">Run one reusable sort sequence before the opening node on a genuinely new game. Continuing a saved game does not replay it.</p>`,
  `<p className=\"project-settings-description\">Run one reusable sort sequence before the opening node on a genuinely new game. Continuing a saved game does not replay it. Startup caption text comes from public/engine-text.txt in a repository build, or installation.txt in a portable build.</p>`,
);

replaceRegexOnce(
  "desktop/main.cjs",
  /async function readAuthorKey\(root\) \{[\s\S]*?\n\}\n\nfunction sendFile/,
  `async function readInstallationSettings(root) {\n  const filename = path.join(root, INSTALLATION_FILE);\n  let text;\n  try {\n    text = await readFile(filename, \"utf8\");\n  } catch (error) {\n    if (error?.code === \"ENOENT\") {\n      return { authorKey: DEFAULT_AUTHOR_KEY, initializeUniverseText: undefined };\n    }\n    throw error;\n  }\n\n  let authorKey = \"\";\n  let initializeUniverseText;\n  for (const rawLine of text.split(/\\r?\\n/)) {\n    const line = rawLine.trim();\n    if (!line || line.startsWith(\"#\")) continue;\n    const separator = line.indexOf(\"=\");\n    if (separator < 0) continue;\n    const name = line.slice(0, separator).trim().toUpperCase();\n    const value = line.slice(separator + 1).trim();\n    if (name === \"AUTHOR_KEY\") {\n      if (!value) throw new Error(\`\${INSTALLATION_FILE} has an empty AUTHOR_KEY.\`);\n      authorKey = value;\n    } else if (name === \"INITIALIZE_UNIVERSE_TEXT\") {\n      initializeUniverseText = value;\n    }\n  }\n  if (!authorKey) throw new Error(\`\${INSTALLATION_FILE} must contain an AUTHOR_KEY=... line.\`);\n  return { authorKey, initializeUniverseText };\n}\n\nfunction sendFile`,
);
replaceOnce(
  "desktop/main.cjs",
  `  const authorKey = await readAuthorKey(root);`,
  `  const installation = await readInstallationSettings(root);\n  const authorKey = installation.authorKey;`,
);
replaceOnce(
  "desktop/main.cjs",
  `      if (url.pathname === \"/\" || url.pathname === \"/index.html\") {`,
  `      if (url.pathname === \"/engine-text.txt\" && typeof installation.initializeUniverseText === \"string\") {\n        const text = \`# Pre-Programmed portable installation-owned player text\\nINITIALIZE_UNIVERSE_TEXT=\${installation.initializeUniverseText}\\n\`;\n        const bytes = Buffer.from(text, \"utf8\");\n        response.writeHead(200, {\n          \"content-type\": \"text/plain; charset=utf-8\",\n          \"content-length\": String(bytes.length),\n          \"cache-control\": \"no-store\",\n        });\n        response.end(bytes);\n        return;\n      }\n\n      if (url.pathname === \"/\" || url.pathname === \"/index.html\") {`,
);
replaceOnce(
  "desktop/main.cjs",
  `    authorKey,\n  };`,
  `    authorKey,\n    initializeUniverseText: installation.initializeUniverseText,\n  };`,
);
replaceOnce(
  "desktop/main.cjs",
  `  const { url, assetWarning, authorKey } = await startLocalHost();`,
  `  const { url, assetWarning, authorKey, initializeUniverseText } = await startLocalHost();`,
);
replaceOnce(
  "desktop/main.cjs",
  `  const healthResponse = await fetch(new URL(\"api/health\", url), { cache: \"no-store\" });`,
  `  const engineTextResponse = await fetch(new URL(\"engine-text.txt\", url), { cache: \"no-store\" });\n  const engineText = await engineTextResponse.text();\n  if (!engineTextResponse.ok || (typeof initializeUniverseText === \"string\"\n    && !engineText.split(/\\r?\\n/).includes(\`INITIALIZE_UNIVERSE_TEXT=\${initializeUniverseText}\`))) {\n    throw new Error(\"Portable installation startup text contract failed.\");\n  }\n\n  const healthResponse = await fetch(new URL(\"api/health\", url), { cache: \"no-store\" });`,
);

write("desktop/installation-template.txt", `# Pre-Programmed local installation settings\n# Change the values below before starting the portable engine.\n# AUTHOR_KEY is the password used for Author mode in this extracted folder.\n# INITIALIZE_UNIVERSE_TEXT is filled from repository public/engine-text.txt when the ZIP is built; after extraction edit it here directly.\n# This file belongs to this local installation. It is not part of .ppgame project exports.\n# If you later host the engine with GitHub/Cloudflare, you may reuse AUTHOR_KEY for the ADMIN_KEY secret or choose a new one.\nAUTHOR_KEY=local\nINITIALIZE_UNIVERSE_TEXT=\n`);

replaceOnce(
  ".github/workflows/build-portable-windows.yml",
  `      - name: Build pre-extracted Windows runtime\n        working-directory: desktop`,
  `      - name: Prepare portable installation text\n        shell: pwsh\n        run: |\n          $sourceLine = @(Get-Content \"public/engine-text.txt\" | Where-Object { $_ -match '^INITIALIZE_UNIVERSE_TEXT=' }) | Select-Object -First 1\n          if ($null -eq $sourceLine) { throw \"public/engine-text.txt must contain INITIALIZE_UNIVERSE_TEXT=...\" }\n          $templatePath = \"desktop/installation-template.txt\"\n          $templateLines = @(Get-Content $templatePath)\n          $found = $false\n          $templateLines = $templateLines | ForEach-Object {\n            if ($_ -match '^INITIALIZE_UNIVERSE_TEXT=') { $found = $true; $sourceLine } else { $_ }\n          }\n          if (-not $found) { throw \"Portable installation template must contain INITIALIZE_UNIVERSE_TEXT=.\" }\n          Set-Content -Path $templatePath -Value $templateLines -Encoding UTF8\n\n      - name: Build pre-extracted Windows runtime\n        working-directory: desktop`,
);
replaceOnce(
  ".github/workflows/build-portable-windows.yml",
  `          if ($installationText -notmatch '(?m)^AUTHOR_KEY=local\\s*$') {\n            throw \"Portable installation.txt did not reset to its friend-facing default.\"\n          }`,
  `          if ($installationText -notmatch '(?m)^AUTHOR_KEY=local\\s*$') {\n            throw \"Portable installation.txt did not reset to its friend-facing Author-key default.\"\n          }\n          $expectedInitializeLine = @(Get-Content \"public/engine-text.txt\" | Where-Object { $_ -match '^INITIALIZE_UNIVERSE_TEXT=' }) | Select-Object -First 1\n          $actualInitializeLine = @(Get-Content (Join-Path $env:APP_ROOT \"installation.txt\") | Where-Object { $_ -match '^INITIALIZE_UNIVERSE_TEXT=' }) | Select-Object -First 1\n          if ($null -eq $expectedInitializeLine -or $actualInitializeLine -ne $expectedInitializeLine) {\n            throw \"Portable installation.txt did not inherit INITIALIZE_UNIVERSE_TEXT from public/engine-text.txt.\"\n          }`,
);

replaceOnce(
  "desktop/portable-readme.txt",
  `3. Optional: open installation.txt and change the value after AUTHOR_KEY= to choose your Author password.\n4. Double-click Pre-Programmed.exe.`,
  `3. Open installation.txt. Set AUTHOR_KEY= for your Author password and INITIALIZE_UNIVERSE_TEXT= for the text shown beneath the new-game startup sort.\n4. Double-click Pre-Programmed.exe.`,
);
replaceOnce(
  "desktop/portable-readme.txt",
  `The data folder contains this installation's local database and Electron runtime state. The exports folder is the default destination for project-file downloads. The engine keeps its writable runtime state inside this extracted Pre-Programmed folder.`,
  `The data folder contains this installation's local database and Electron runtime state. The exports folder is the default destination for project-file downloads. installation.txt owns this extracted installation's Author password and startup phrase. The engine keeps its writable runtime state inside this extracted Pre-Programmed folder.`,
);

replaceOnce(
  "README.md",
  `public/assets/             version-controlled file Media`,
  `public/engine-text.txt     human-editable installation-owned player text\npublic/assets/             version-controlled file Media`,
);
replaceOnce(
  "README.md",
  "`installation.txt` owns that local installation's Author key. `.ppgame` owns portable authored project data. The Author key is not part of `.ppgame`; a future hosted installation may reuse the same value for its `ADMIN_KEY` secret or choose a different one.",
  "`public/engine-text.txt` is the repository-facing plain-text home for installation-owned player wording such as `INITIALIZE_UNIVERSE_TEXT`. The portable workflow copies that value into the extracted `installation.txt`, beside `AUTHOR_KEY`, so a portable author can change the startup phrase and local Author password in one place. `.ppgame` remains the owner of portable authored project data; neither installation setting is stored in the project export. A future hosted installation may reuse the portable `AUTHOR_KEY` value for its `ADMIN_KEY` secret or choose a different one.",
);

console.log("Applied public/portable installation-owned initialize-universe text changes.");
