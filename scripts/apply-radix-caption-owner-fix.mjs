import { readFile, writeFile, rm } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected source block was not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path}: expected source block was not unique`);
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await replaceOnce(
  "src/App.tsx",
  `import { loadInstallationPublicSettings } from "./platform/installation/publicSettings";\n`,
  "",
);

await replaceOnce(
  "src/App.tsx",
  `  const [installationText, setInstallationText] = useState({ ready: false, initializeUniverseText: "initialize universe" });\n`,
  "",
);

await replaceOnce(
  "src/App.tsx",
  `  useEffect(() => {\n    let cancelled = false;\n    void loadInstallationPublicSettings().then((settings) => {\n      if (!cancelled) setInstallationText({ ready: true, initializeUniverseText: settings.initializeUniverseText });\n    });\n    return () => { cancelled = true; };\n  }, []);\n\n`,
  "",
);

await replaceOnce(
  "src/App.tsx",
  `    if (!snapshot || !playState || !installationText.ready || startupRunRef.current) return;`,
  `    if (!snapshot || !playState || startupRunRef.current) return;`,
);

await replaceOnce(
  "src/App.tsx",
  `  }, [snapshot, playState, installationText.ready]);`,
  `  }, [snapshot, playState]);`,
);

await replaceOnce(
  "src/App.tsx",
  `        captionOverride={activeRadix.startup ? installationText.initializeUniverseText : undefined}\n`,
  "",
);

await replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `help: "Player-facing text shown below ordinary sequence runs. App launch uses installation-owned INITIALIZE_UNIVERSE_TEXT instead."`,
  `help: "Player-facing text shown below every run of this sequence, including when this sequence is selected for app launch."`,
);

await replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `<p className="project-settings-description">Run one reusable sort sequence once whenever the player app opens, before the saved-game choice or normal play is revealed. It does not count as entering a node. Launch caption text comes from public/engine-text.txt in a repository build, or installation.txt in a portable build.</p>`,
  `<p className="project-settings-description">Run one reusable sort sequence once whenever the player app opens, before the saved-game choice or normal play is revealed. It does not count as entering a node. The selected sequence's own CAPTION is shown beneath it.</p>`,
);

await replaceOnce(
  "desktop/main.cjs",
  `      return { authorKey: DEFAULT_AUTHOR_KEY, initializeUniverseText: undefined };`,
  `      return { authorKey: DEFAULT_AUTHOR_KEY };`,
);

await replaceOnce(
  "desktop/main.cjs",
  `  let initializeUniverseText;\n`,
  "",
);

await replaceOnce(
  "desktop/main.cjs",
  `    } else if (name === "INITIALIZE_UNIVERSE_TEXT") {\n      initializeUniverseText = value;\n    }\n`,
  `    }\n`,
);

await replaceOnce(
  "desktop/main.cjs",
  `  return { authorKey, initializeUniverseText };`,
  `  return { authorKey };`,
);

await replaceOnce(
  "desktop/main.cjs",
  `      if (url.pathname === "/engine-text.txt" && typeof installation.initializeUniverseText === "string") {\n        const text = \`# Pre-Programmed portable installation-owned player text\\nINITIALIZE_UNIVERSE_TEXT=\${installation.initializeUniverseText}\\n\`;\n        const bytes = Buffer.from(text, "utf8");\n        response.writeHead(200, {\n          "content-type": "text/plain; charset=utf-8",\n          "content-length": String(bytes.length),\n          "cache-control": "no-store",\n        });\n        response.end(bytes);\n        return;\n      }\n\n`,
  "",
);

await replaceOnce(
  "desktop/main.cjs",
  `    authorKey,\n    initializeUniverseText: installation.initializeUniverseText,\n`,
  `    authorKey,\n`,
);

await replaceOnce(
  "desktop/main.cjs",
  `  const { url, assetWarning, authorKey, initializeUniverseText } = await startLocalHost();`,
  `  const { url, assetWarning, authorKey } = await startLocalHost();`,
);

await replaceOnce(
  "desktop/main.cjs",
  `  const engineTextResponse = await fetch(new URL("engine-text.txt", url), { cache: "no-store" });\n  const engineText = await engineTextResponse.text();\n  if (!engineTextResponse.ok || (typeof initializeUniverseText === "string"\n    && !engineText.split(/\\r?\\n/).includes(\`INITIALIZE_UNIVERSE_TEXT=\${initializeUniverseText}\`))) {\n    throw new Error("Portable installation startup text contract failed.");\n  }\n\n`,
  "",
);

await writeFile(
  "desktop/installation-template.txt",
  `# Pre-Programmed local installation settings\n# Change the value below before starting the portable engine.\n# AUTHOR_KEY is the password used for Author mode in this extracted folder.\n# Player-visible game text, including launch-sequence captions, belongs to the authored .ppgame project.\n# This file belongs to this local installation. It is not part of .ppgame project exports.\n# If you later host the engine with GitHub/Cloudflare, you may reuse AUTHOR_KEY for the ADMIN_KEY secret or choose a new one.\nAUTHOR_KEY=local\n`,
);

await replaceOnce(
  "desktop/portable-readme.txt",
  `3. Open installation.txt. Set AUTHOR_KEY= for your Author password and INITIALIZE_UNIVERSE_TEXT= for the text shown beneath the new-game startup sort.`,
  `3. Open installation.txt. Set AUTHOR_KEY= for your Author password. Launch-sequence captions are authored on the Sort Sequence itself and travel with the .ppgame project.`,
);

await replaceOnce(
  "desktop/portable-readme.txt",
  `installation.txt owns this extracted installation's Author password and startup phrase.`,
  `installation.txt owns this extracted installation's Author password.`,
);

await replaceOnce(
  "README.md",
  `public/engine-text.txt     human-editable installation-owned player text\n`,
  "",
);

await replaceOnce(
  "README.md",
  `\`public/engine-text.txt\` is the repository-facing plain-text home for installation-owned player wording such as \`INITIALIZE_UNIVERSE_TEXT\`. The portable workflow copies that value into the extracted \`installation.txt\`, beside \`AUTHOR_KEY\`, so a portable author can change the startup phrase and local Author password in one place. \`.ppgame\` remains the owner of portable authored project data; neither installation setting is stored in the project export. A future hosted installation may reuse the portable \`AUTHOR_KEY\` value for its \`ADMIN_KEY\` secret or choose a different one.`,
  `\`installation.txt\` owns local installation settings such as \`AUTHOR_KEY\`. Player-visible launch-sequence text is authored on the Sort Sequence itself, so it uses the same canonical editor and travels with the \`.ppgame\` project across hosted, local, and portable builds. A future hosted installation may reuse the portable \`AUTHOR_KEY\` value for its \`ADMIN_KEY\` secret or choose a different one.`,
);

await rm("src/platform/installation/publicSettings.ts");
await rm("public/engine-text.txt");
await rm("scripts/apply-radix-caption-owner-fix.mjs");
