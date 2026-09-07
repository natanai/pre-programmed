import { readFileSync, writeFileSync } from "node:fs";

const path = "src/App.tsx";
let source = readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Expected one ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceRegexOnce(pattern, after, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing ${label}`);
  source = source.replace(pattern, after);
  if (source.match(pattern)) throw new Error(`Expected one ${label}`);
}

function replaceCount(before, after, expected, label) {
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} ${label}, found ${count}`);
  source = source.split(before).join(after);
}

replaceOnce(
  'import { RadixSequenceSurface } from "./features/radix/ui/RadixSequenceSurface";',
  'import { useRadixRuntimePresentation } from "./features/radix/runtime/useRadixRuntimePresentation";',
  "direct Radix surface import",
);

replaceRegexOnce(
  /\ntype ActiveRadixPresentation = \{\n  sequenceId: string;\n  runKey: string;\n  startup: boolean;\n  source\?: AuthoredSourceIdentity;\n\};\n/,
  "\n",
  "App-owned Radix presentation type",
);

replaceOnce(
  '  const [activeRadix, setActiveRadix] = useState<ActiveRadixPresentation | null>(null);\n',
  "",
  "App-owned Radix state",
);

replaceOnce(
  '  const startupRunRef = useRef(false);\n  const startupActiveRef = useRef(false);',
  '  const launchPresentationBlockingRef = useRef(false);',
  "Radix startup refs",
);

replaceOnce(
  '  const canEditAuthorSource = (source?: AuthoredSourceIdentity) => Boolean(\n    snapshot && source && authorRouteForSource(snapshot, source),\n  );',
  `  const canEditAuthorSource = (source?: AuthoredSourceIdentity) => Boolean(\n    snapshot && source && authorRouteForSource(snapshot, source),\n  );\n\n  const radixPresentation = useRadixRuntimePresentation({\n    snapshot,\n    launchBlockingRef: launchPresentationBlockingRef,\n    authorMode: authorMode && authorView,\n    onStartupBegin: () => {\n      setActiveText(\"\");\n      setActiveNodeId(undefined);\n      setActiveSpeakerId(null);\n      setActiveSource(undefined);\n      setActivePerformance({ ...DEFAULT_TEXT_PERFORMANCE });\n      setPendingDestinationNodeId(null);\n    },\n    onStartupComplete: () => {\n      if (!snapshot || !playState || pendingPlaySession) return;\n      const node = snapshot.nodes.find((candidate) => candidate.id === playState.currentNodeId);\n      if (node) showNode(snapshot, node, playState);\n    },\n    onEditSequence: (sequenceId) => openAuthorResource(\"radix-sequence\", sequenceId),\n    onEditSource: (source) => openAuthorSource(source),\n    canEditSource: canEditAuthorSource,\n  });`,
  "Radix runtime controller installation point",
);

replaceOnce(
  '  const showNode = (project: ProjectSnapshot, node: GameNode, state: PlayState) => {\n    if (startupActiveRef.current) return;',
  '  function showNode(project: ProjectSnapshot, node: GameNode, state: PlayState) {\n    if (launchPresentationBlockingRef.current) return;',
  "showNode startup guard",
);

replaceOnce(
  '    setActivePerformance(compiled.performance);\n  };\n\n  const beginLaunchPresentation',
  '    setActivePerformance(compiled.performance);\n  }\n\n  const beginLaunchPresentation',
  "showNode function ending",
);

replaceRegexOnce(
  /\n  const beginLaunchPresentation = \(project: ProjectSnapshot\) => \{[\s\S]*?\n  \};\n\n(?=  useEffect\(\(\) => \{)/,
  "\n",
  "App-owned Radix startup selector",
);

replaceRegexOnce(
  /\n  useEffect\(\(\) => \{\n    if \(!snapshot \|\| !playState \|\| !activeRadix\) return;[\s\S]*?\n  \}, \[snapshot, playState, activeRadix, pendingPlaySession\]\);\n/,
  "\n",
  "App-owned Radix reconciliation effect",
);

replaceCount(
  '    startupRunRef.current = true;\n    startupActiveRef.current = false;\n    setActiveRadix(null);',
  '    radixPresentation.suppressStartup();',
  2,
  "session Radix reset blocks",
);

replaceCount(
  "beginLaunchPresentation(",
  "radixPresentation.beginStartup(",
  2,
  "startup launch calls",
);

replaceOnce(
  `        showRadixSequence(sequenceId, source) {\n          if (!snapshot.settings.radix.sequences.some((sequence) => sequence.id === sequenceId)) return;\n          setActiveRadix({\n            sequenceId,\n            runKey: crypto.randomUUID(),\n            startup: false,\n            source,\n          });\n        },`,
  `        showRadixSequence(sequenceId, source) {\n          radixPresentation.showSequence(sequenceId, source);\n        },`,
  "effect surface Radix implementation",
);

replaceOnce(
  `  const activeRadixSequence = activeRadix\n    ? snapshot.settings.radix.sequences.find((sequence) => sequence.id === activeRadix.sequenceId)\n    : undefined;\n  const activeRadixSynth = activeRadixSequence?.synthId\n    ? snapshot.synthSounds.find((sound) => sound.id === activeRadixSequence.synthId)\n    : undefined;\n`,
  "",
  "App Radix sequence and synth lookup",
);

replaceRegexOnce(
  /\n  const finishActiveRadix = \(\) => \{[\s\S]*?\n  \};\n\n(?=  return <main)/,
  "\n",
  "App Radix completion handler",
);

replaceRegexOnce(
  /      \{activeRadix && activeRadixSequence \? <RadixSequenceSurface[\s\S]*?      \/> : null\}/,
  "      {radixPresentation.surface}",
  "direct Radix rendering",
);

replaceCount("activeRadix?.startup", "radixPresentation.startup", 1, "startup autosave guard");

if (source.includes("activeRadixSequence") || source.includes("activeRadixSynth")) {
  throw new Error("Radix sequence resolution remains in App");
}
if (source.includes("setActiveRadix")) throw new Error("Radix state mutation remains in App");

source = source.split("activeRadix").join("radixPresentation.active");

for (const forbidden of [
  "ActiveRadixPresentation",
  "startupRunRef",
  "startupActiveRef",
  "RadixSequenceSurface",
  "settings.radix.sequences.some",
]) {
  if (source.includes(forbidden)) throw new Error(`Forbidden App Radix implementation detail remains: ${forbidden}`);
}

for (const required of [
  'useRadixRuntimePresentation',
  'radixPresentation.beginStartup',
  'radixPresentation.suppressStartup',
  'radixPresentation.showSequence',
  'radixPresentation.surface',
  'launchPresentationBlockingRef',
]) {
  if (!source.includes(required)) throw new Error(`Expected App integration missing: ${required}`);
}

writeFileSync(path, source);
