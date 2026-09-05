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
  if (!text.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 120)}`);
  write(path, text.replace(from, to));
}

function replaceRegexOnce(path, pattern, to) {
  const text = read(path);
  if (!pattern.test(text)) throw new Error(`Pattern not found in ${path}: ${pattern}`);
  pattern.lastIndex = 0;
  write(path, text.replace(pattern, to));
}

write("engine-text.txt", `# Pre-Programmed installation-owned player text\n# This file is intentionally plain text so a fork/clone author can change startup wording without opening source code or project data.\n# The Windows portable build copies this value into installation.txt beside the local Author password.\n# Leave the value empty to hide the startup caption.\nINITIALIZE_UNIVERSE_TEXT=initialize universe\n`);

write("src/platform/installation/publicSettings.ts", `declare const __PRE_PROGRAMMED_INITIALIZE_UNIVERSE_TEXT__: string;\n\ndeclare global {\n  interface Window {\n    __PRE_PROGRAMMED_INSTALLATION__?: {\n      initializeUniverseText?: string;\n    };\n  }\n}\n\n/**\n * Public installation-level presentation text. Hosted builds receive the\n * repository value at build time; the portable desktop host may override it\n * from the extracted installation.txt without exposing the Author password.\n */\nexport function installationInitializeUniverseText() {\n  const runtime = typeof window === \"undefined\" ? undefined : window.__PRE_PROGRAMMED_INSTALLATION__;\n  return typeof runtime?.initializeUniverseText === \"string\"\n    ? runtime.initializeUniverseText\n    : __PRE_PROGRAMMED_INITIALIZE_UNIVERSE_TEXT__;\n}\n`);

write("vite.config.ts", `import { readFileSync } from \"node:fs\";\nimport { fileURLToPath } from \"node:url\";\nimport react from \"@vitejs/plugin-react\";\nimport { defineConfig, loadEnv } from \"vite\";\n\nconst ENGINE_TEXT_FILE = fileURLToPath(new URL(\"./engine-text.txt\", import.meta.url));\n\nfunction installationTextValue(name: string, fallback: string) {\n  let text: string;\n  try {\n    text = readFileSync(ENGINE_TEXT_FILE, \"utf8\");\n  } catch {\n    return fallback;\n  }\n  for (const rawLine of text.split(/\\r?\\n/)) {\n    const line = rawLine.trim();\n    if (!line || line.startsWith(\"#\")) continue;\n    const separator = line.indexOf(\"=\");\n    if (separator < 0) continue;\n    if (line.slice(0, separator).trim().toUpperCase() !== name.toUpperCase()) continue;\n    return line.slice(separator + 1).trim();\n  }\n  return fallback;\n}\n\nexport default defineConfig(({ mode }) => {\n  const env = loadEnv(mode, \".\", \"\");\n  const configuredBase = env.VITE_BASE_PATH?.trim();\n  const initializeUniverseText = installationTextValue(\"INITIALIZE_UNIVERSE_TEXT\", \"initialize universe\");\n\n  return {\n    base: mode === \"pages\" ? (configuredBase || \"/pre-programmed/\") : \"/\",\n    define: {\n      __PRE_PROGRAMMED_INITIALIZE_UNIVERSE_TEXT__: JSON.stringify(initializeUniverseText),\n    },\n    plugins: [react()],\n    server: {\n      proxy: {\n        \"/api\": \"http://127.0.0.1:8787\",\n      },\n    },\n  };\n});\n`);

replaceOnce(
  "src/App.tsx",
  `import { configuredProjectPersistence } from \"./platform/persistence/configuredProjectPersistence\";`,
  `import { installationInitializeUniverseText } from \"./platform/installation/publicSettings\";\nimport { configuredProjectPersistence } from \"./platform/persistence/configuredProjectPersistence\";`,
);
replaceOnce(
  "src/App.tsx",
  `        sequence={activeRadixSequence}\n        synth={activeRadixSynth}\n        runKey={activeRadix.runKey}`,
  `        sequence={activeRadixSequence}\n        synth={activeRadixSynth}\n        captionOverride={activeRadix.startup ? installationInitializeUniverseText() : undefined}\n        runKey={activeRadix.runKey}`,
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
  `help: \"Player-facing text shown below the visualization for ordinary sequence runs. New-game startup uses the installation-owned INITIALIZE_UNIVERSE_TEXT instead.\"`,
);
replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `<p className=\"project-settings-description\">Run one reusable sort sequence before the opening node on a genuinely new game. Continuing a saved game does not replay it.</p>`,
  `<p className=\"project-settings-description\">Run one reusable sort sequence before the opening node on a genuinely new game. Continuing a saved game does not replay it. Its caption comes from the installation-owned INITIALIZE_UNIVERSE_TEXT so repository and portable installations can set their own startup wording.</p>`,
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
  `  const manifestScript = \`<script>window.__PRE_PROGRAMMED_PORTABLE_ASSETS__=\${JSON.stringify(portableAssets).replace(/</g, \"\\\\u003c\")};</script>\`;\n  const indexHtml = indexTemplate.includes(\"</head>\")\n    ? indexTemplate.replace(\"</head>\", \`\${manifestScript}</head>\`)\n    : \`\${manifestScript}\${indexTemplate}\`;`,
  `  const manifestScript = \`<script>window.__PRE_PROGRAMMED_PORTABLE_ASSETS__=\${JSON.stringify(portableAssets).replace(/</g, \"\\\\u003c\")};</script>\`;\n  const publicInstallation = typeof installation.initializeUniverseText === \"string\"\n    ? { initializeUniverseText: installation.initializeUniverseText }\n    : {};\n  const installationScript = \`<script>window.__PRE_PROGRAMMED_INSTALLATION__=\${JSON.stringify(publicInstallation).replace(/</g, \"\\\\u003c\")};</script>\`;\n  const bootScripts = \`\${manifestScript}\${installationScript}\`;\n  const indexHtml = indexTemplate.includes(\"</head>\")\n    ? indexTemplate.replace(\"</head>\", \`\${bootScripts}</head>\`)\n    : \`\${bootScripts}\${indexTemplate}\`;`,
);
replaceOnce(
  "desktop/main.cjs",
  `    authorKey,\n  };`,
  `    authorKey,\n    initializeUniverseText: installation.initializeUniverseText,\n  };`,
);
replaceOnce(
  "desktop/main.cjs",
  `  const { url, assetWarning, authorKey } = await startLocalHost();`,
  `  const { url, assetWarning, authorKey } = await startLocalHost();`,
);
replaceOnce(
  "desktop/main.cjs",
  `  if (!indexResponse.ok || !indexText.includes(\"__PRE_PROGRAMMED_PORTABLE_ASSETS__\")) {`,
  `  if (!indexResponse.ok\n    || !indexText.includes(\"__PRE_PROGRAMMED_PORTABLE_ASSETS__\")\n    || !indexText.includes(\"__PRE_PROGRAMMED_INSTALLATION__\")) {`,
);

write("desktop/installation-template.txt", `# Pre-Programmed local installation settings\n# Change the values below before starting the portable engine.\n# AUTHOR_KEY is the password used for Author mode in this extracted folder.\n# INITIALIZE_UNIVERSE_TEXT is filled from repository engine-text.txt when the ZIP is built; after extraction you can edit it here directly.\n# This file belongs to this local installation. It is not part of .ppgame project exports.\n# If you later host the engine with GitHub/Cloudflare, you may reuse AUTHOR_KEY for the ADMIN_KEY secret or choose a new one.\nAUTHOR_KEY=local\nINITIALIZE_UNIVERSE_TEXT=\n`);

replaceOnce(
  ".github/workflows/build-portable-windows.yml",
  `      - name: Build pre-extracted Windows runtime\n        working-directory: desktop`,
  `      - name: Prepare portable installation text\n        shell: pwsh\n        run: |\n          $sourceLine = @(Get-Content \"engine-text.txt\" | Where-Object { $_ -match '^INITIALIZE_UNIVERSE_TEXT=' }) | Select-Object -First 1\n          if ($null -eq $sourceLine) { throw \"engine-text.txt must contain INITIALIZE_UNIVERSE_TEXT=...\" }\n          $templatePath = \"desktop/installation-template.txt\"\n          $templateLines = @(Get-Content $templatePath)\n          $found = $false\n          $templateLines = $templateLines | ForEach-Object {\n            if ($_ -match '^INITIALIZE_UNIVERSE_TEXT=') { $found = $true; $sourceLine } else { $_ }\n          }\n          if (-not $found) { throw \"Portable installation template must contain INITIALIZE_UNIVERSE_TEXT=.\" }\n          Set-Content -Path $templatePath -Value $templateLines -Encoding UTF8\n\n      - name: Build pre-extracted Windows runtime\n        working-directory: desktop`,
);
replaceOnce(
  ".github/workflows/build-portable-windows.yml",
  `          if ($installationText -notmatch '(?m)^AUTHOR_KEY=local\\s*$') {\n            throw \"Portable installation.txt did not reset to its friend-facing default.\"\n          }`,
  `          if ($installationText -notmatch '(?m)^AUTHOR_KEY=local\\s*$') {\n            throw \"Portable installation.txt did not reset to its friend-facing Author-key default.\"\n          }\n          $expectedInitializeLine = @(Get-Content \"engine-text.txt\" | Where-Object { $_ -match '^INITIALIZE_UNIVERSE_TEXT=' }) | Select-Object -First 1\n          $actualInitializeLine = @(Get-Content (Join-Path $env:APP_ROOT \"installation.txt\") | Where-Object { $_ -match '^INITIALIZE_UNIVERSE_TEXT=' }) | Select-Object -First 1\n          if ($null -eq $expectedInitializeLine -or $actualInitializeLine -ne $expectedInitializeLine) {\n            throw \"Portable installation.txt did not inherit INITIALIZE_UNIVERSE_TEXT from engine-text.txt.\"\n          }`,
);

replaceOnce(
  "desktop/portable-readme.txt",
  `3. Optional: open installation.txt and change the value after AUTHOR_KEY= to choose your Author password.\n4. Double-click Pre-Programmed.exe.`,
  `3. Open installation.txt. You can set AUTHOR_KEY= for your Author password and INITIALIZE_UNIVERSE_TEXT= for the text shown beneath the new-game startup sort.\n4. Double-click Pre-Programmed.exe.`,
);
replaceOnce(
  "desktop/portable-readme.txt",
  `The data folder contains this installation's local database and Electron runtime state. The exports folder is the default destination for project-file downloads. The engine keeps its writable runtime state inside this extracted Pre-Programmed folder.`,
  `The data folder contains this installation's local database and Electron runtime state. The exports folder is the default destination for project-file downloads. installation.txt owns this extracted installation's Author password and startup phrase. The engine keeps its writable runtime state inside this extracted Pre-Programmed folder.`,
);

replaceOnce(
  "README.md",
  `public/assets/             version-controlled file Media`,
  `engine-text.txt            human-editable installation-owned player text\npublic/assets/             version-controlled file Media`,
);
replaceOnce(
  "README.md",
  `` + "`installation.txt` owns that local installation's Author key. `.ppgame` owns portable authored project data. The Author key is not part of `.ppgame`; a future hosted installation may reuse the same value for its `ADMIN_KEY` secret or choose a different one." + ``,
  `` + "`engine-text.txt` is the repository-facing plain-text home for installation-owned player wording such as `INITIALIZE_UNIVERSE_TEXT`. The portable workflow copies that value into the extracted `installation.txt`, beside `AUTHOR_KEY`, so a portable author can change the startup phrase and local Author password in one place. `.ppgame` remains the owner of portable authored project data; neither installation setting is stored in the project export. A future hosted installation may reuse the portable `AUTHOR_KEY` value for its `ADMIN_KEY` secret or choose a different one." + ``,
);

console.log("Applied installation-owned initialize-universe text changes.");
