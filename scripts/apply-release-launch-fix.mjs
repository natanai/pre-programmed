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
  `  useEffect(() => {\n    if (!snapshot || !playState || !playSessionReady || pendingPlaySession || !installationText.ready || startupRunRef.current) return;`,
  `  useEffect(() => {\n    if (!snapshot || !playState || !installationText.ready || startupRunRef.current) return;`,
);

await replaceOnce(
  "src/App.tsx",
  `  }, [snapshot, playState, playSessionReady, pendingPlaySession, installationText.ready]);`,
  `  }, [snapshot, playState, installationText.ready]);`,
);

await replaceOnce(
  "src/App.tsx",
  `    startupRunRef.current = false;\n    startupActiveRef.current = false;\n    setActiveRadix(null);`,
  `    startupRunRef.current = true;\n    startupActiveRef.current = false;\n    setActiveRadix(null);`,
);

await replaceOnce(
  "src/App.tsx",
  `    {pendingPlaySession ? <PlayerSessionGate session={pendingPlaySession} onContinue={continuePlaySession} onNewGame={startNewGame} /> : null}`,
  `    {pendingPlaySession && !activeRadix ? <PlayerSessionGate session={pendingPlaySession} onContinue={continuePlaySession} onNewGame={startNewGame} /> : null}`,
);

await replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `help: "Player-facing text shown below ordinary sequence runs. New-game startup uses installation-owned INITIALIZE_UNIVERSE_TEXT instead."`,
  `help: "Player-facing text shown below ordinary sequence runs. App launch uses installation-owned INITIALIZE_UNIVERSE_TEXT instead."`,
);

await replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `const result = await context.persist([{ type: "project.settings", settings }], "Changed player startup sort sequence");`,
  `const result = await context.persist([{ type: "project.settings", settings }], "Changed player launch sort sequence");`,
);

await replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `    <h3>PLAYER STARTUP</h3>\n    <p className="project-settings-description">Run one reusable sort sequence before the opening node on a genuinely new game. Continuing a saved game does not replay it. Startup caption text comes from public/engine-text.txt in a repository build, or installation.txt in a portable build.</p>\n    <label className="check-label"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> enabled on new game</label>\n    <ReferenceField kind="radix-sequence" value={sequenceId} onChange={setSequenceId} placeholder="Choose startup sequence" />\n    <div className="project-setting-actions">\n      <button type="button" disabled={!dirty || saving || (enabled && !sequenceId)} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>\n      {sequenceId ? <button type="button" onClick={() => context.runtime.events([{ type: "radix", sequenceId }])}>[PREVIEW]</button> : null}\n    </div>`,
  `    <h3>PLAYER LAUNCH</h3>\n    <p className="project-settings-description">Run one reusable sort sequence once whenever the player app opens, before the saved-game choice or normal play is revealed. It does not count as entering a node. Launch caption text comes from public/engine-text.txt in a repository build, or installation.txt in a portable build.</p>\n    <label className="check-label"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> enabled on app launch</label>\n    <ReferenceField kind="radix-sequence" value={sequenceId} onChange={setSequenceId} placeholder="Choose launch sequence" />\n    <div className="project-setting-actions">\n      <button type="button" disabled={!dirty || saving || (enabled && !sequenceId)} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>\n      {sequenceId ? <button type="button" onClick={() => context.runtime.events([{ type: "radix", sequenceId }])}>[PREVIEW]</button> : null}\n      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "radix", workspace: "sequences" })}>[OPEN SORT SEQUENCES]</button>\n    </div>`,
);

await replaceOnce(
  "src/features/radix/author/workspaces.tsx",
  `  label: "STARTUP SEQUENCE",\n  description: "Choose whether a reusable sort presentation runs before the opening node."`,
  `  label: "LAUNCH SEQUENCE",\n  description: "Choose whether a reusable sort presentation runs once when the player app opens."`,
);

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `    let started = false;`,
  `    let started = false;\n    let finished = false;\n    let audioStarting = false;`,
);

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `    const finish = () => {\n      if (cancelled) return;\n      toneRef.current?.stop();`,
  `    const finish = () => {\n      if (cancelled) return;\n      finished = true;\n      toneRef.current?.stop();`,
);

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `    const begin = async () => {\n      if (started || cancelled) return;\n      if (stableSequence.soundEnabled) {\n        const unlocked = await unlockProceduralAudio();\n        if (!unlocked || cancelled) {\n          if (!cancelled) setAwaitingAudioGesture(true);\n          return;\n        }\n        toneRef.current = await createProceduralToneSession(stableSynth, stableSequence.volume);\n      }\n      if (cancelled) return;\n      started = true;\n      setAwaitingAudioGesture(false);\n      lastTime = performance.now();\n      frame = window.requestAnimationFrame(tick);\n    };\n\n    draw();\n    resizeObserver = new ResizeObserver(draw);\n    resizeObserver.observe(canvas);\n    void begin();\n\n    const unlock = () => { void begin(); };`,
  `    const ensureAudio = async () => {\n      if (!stableSequence.soundEnabled || toneRef.current || audioStarting || cancelled || finished) return;\n      audioStarting = true;\n      const unlocked = await unlockProceduralAudio();\n      if (!unlocked || cancelled || finished) {\n        audioStarting = false;\n        if (!cancelled && !finished) setAwaitingAudioGesture(true);\n        return;\n      }\n      const tone = await createProceduralToneSession(stableSynth, stableSequence.volume);\n      audioStarting = false;\n      if (cancelled || finished) {\n        tone?.stop();\n        return;\n      }\n      toneRef.current = tone;\n      setAwaitingAudioGesture(false);\n    };\n\n    const begin = () => {\n      if (started || cancelled) return;\n      started = true;\n      lastTime = performance.now();\n      frame = window.requestAnimationFrame(tick);\n      void ensureAudio();\n    };\n\n    draw();\n    resizeObserver = new ResizeObserver(draw);\n    resizeObserver.observe(canvas);\n    begin();\n\n    const unlock = () => { void ensureAudio(); };`,
);

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `[TAP / PRESS ANY KEY TO START WITH SOUND]`,
  `[TAP / PRESS ANY KEY FOR SOUND]`,
);

await replaceOnce(
  ".github/workflows/build-portable-windows.yml",
  `permissions:\n  contents: read`,
  `permissions:\n  contents: write`,
);

await replaceOnce(
  ".github/workflows/build-portable-windows.yml",
  `          "version=$version" >> $env:GITHUB_OUTPUT\n\n      - name: Install engine dependencies`,
  `          "version=$version" >> $env:GITHUB_OUTPUT\n\n      - name: Verify release source\n        shell: pwsh\n        run: |\n          if ("${{ github.ref }}" -ne "refs/heads/main") {\n            throw "Versioned portable releases must be built from main."\n          }\n\n      - name: Install engine dependencies`,
);

await replaceOnce(
  ".github/workflows/build-portable-windows.yml",
  `          "ZIP_PATH=$zip" >> $env:GITHUB_ENV\n          "ZIP_NAME=Pre-Programmed-v$env:VERSION-windows-x64" >> $env:GITHUB_ENV\n\n      - name: Upload portable ZIP\n        uses: actions/upload-artifact@v4\n        with:\n          name: ${{ env.ZIP_NAME }}\n          path: ${{ env.ZIP_PATH }}\n          if-no-files-found: error\n          retention-days: 30`,
  `          "ZIP_PATH=$zip" >> $env:GITHUB_ENV\n\n      - name: Publish GitHub Release\n        shell: pwsh\n        env:\n          GH_TOKEN: ${{ github.token }}\n          VERSION: ${{ steps.version.outputs.version }}\n        run: |\n          $tag = "v$env:VERSION"\n          $existingTag = git ls-remote --tags origin "refs/tags/$tag"\n          if ($existingTag) {\n            throw "Release tag $tag already exists. Choose a new version so published builds stay immutable."\n          }\n\n          $arguments = @(\n            "release", "create", $tag, $env:ZIP_PATH,\n            "--repo", $env:GITHUB_REPOSITORY,\n            "--target", $env:GITHUB_SHA,\n            "--title", "Pre-Programmed $tag",\n            "--generate-notes"\n          )\n          if ($env:VERSION -match '-') { $arguments += "--prerelease" }\n          & gh @arguments\n          if ($LASTEXITCODE -ne 0) { throw "GitHub Release publication failed." }`,
);

await replaceOnce(
  "README.md",
  `5. Download the resulting \`Pre-Programmed-v<version>-windows-x64\` artifact when the workflow finishes.\n\nThe workflow verifies the engine, persistent no-cloud runtime, and hosted deployment shape before packaging. It removes \`public/assets/\` only inside the disposable Actions checkout so the distributed ZIP contains no installation's repository Media or authored game. It then builds and smoke-tests a self-contained, pre-extracted Windows folder and uploads that folder as a ZIP.`,
  `5. When the workflow finishes, open the new GitHub Release \`v<version>\` and download \`Pre-Programmed-v<version>-windows-x64.zip\` directly from its Assets.\n\nThe workflow only publishes versioned releases from \`main\`, and an existing release tag cannot be replaced: choose a new version for each published build. The workflow verifies the engine, persistent no-cloud runtime, and hosted deployment shape before packaging. It removes \`public/assets/\` only inside the disposable Actions checkout so the distributed ZIP contains no installation's repository Media or authored game. It then builds and smoke-tests a self-contained, pre-extracted Windows folder and attaches that single ZIP directly to the GitHub Release rather than wrapping it inside an Actions artifact ZIP.`,
);

await rm("scripts/apply-release-launch-fix.mjs");
await rm(".github/workflows/apply-release-launch-fix.yml");
