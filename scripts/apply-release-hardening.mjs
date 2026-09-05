import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected source block was not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path}: expected source block was not unique`);
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `  synth?: SynthSound;\n  captionOverride?: string;\n  runtimeSeed?: number;`,
  `  synth?: SynthSound;\n  runtimeSeed?: number;`,
);

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `  sequence,\n  synth,\n  captionOverride,\n  runtimeSeed,`,
  `  sequence,\n  synth,\n  runtimeSeed,`,
);

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `  const [awaitingAudioGesture, setAwaitingAudioGesture] = useState(false);\n  const caption = captionOverride ?? sequence.caption;`,
  `  const [awaitingAudioGesture, setAwaitingAudioGesture] = useState(false);`,
);

await replaceOnce(
  "src/features/radix/ui/RadixSequenceSurface.tsx",
  `    {caption ? <div className="radix-caption">{caption}</div> : null}`,
  `    {sequence.caption ? <div className="radix-caption">{sequence.caption}</div> : null}`,
);
