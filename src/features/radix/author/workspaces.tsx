import { useEffect, useMemo, useState } from "react";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { AuthorProjectSettingsSection } from "../../../author/features/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import {
  SORT_ALGORITHM_LABELS,
  type RadixSequenceDefinition,
  type SortAlgorithm,
} from "../model";
import { createRadixSequence } from "../model";

const SORT_ALGORITHMS = Object.entries(SORT_ALGORITHM_LABELS) as Array<[SortAlgorithm, string]>;

function numberValue(value: string, fallback: number, min: number, max: number, integer = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(max, Math.max(min, parsed));
  return integer ? Math.round(bounded) : bounded;
}

function validColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function validSequence(sequence: RadixSequenceDefinition) {
  return Boolean(sequence.label.trim())
    && sequence.arraySize >= 8 && sequence.arraySize <= 1024
    && sequence.radix >= 2 && sequence.radix <= 16
    && sequence.delayMs >= 0 && sequence.delayMs <= 250
    && sequence.finishHoldMs >= 0 && sequence.finishHoldMs <= 10000
    && sequence.heightPx >= 96 && sequence.heightPx <= 1200
    && sequence.minFrequency >= 20 && sequence.minFrequency <= 12000
    && sequence.maxFrequency >= sequence.minFrequency && sequence.maxFrequency <= 16000
    && sequence.volume >= 0 && sequence.volume <= 1
    && sequence.toneStride >= 1 && sequence.toneStride <= 64
    && [sequence.backgroundColor, sequence.barColor, sequence.accessColor, sequence.markerColor].every(validColor);
}

function sequenceDetail(sequence: RadixSequenceDefinition) {
  const base = sequence.algorithm === "radix-lsd" ? ` · base ${sequence.radix}` : "";
  return `${SORT_ALGORITHM_LABELS[sequence.algorithm]} · ${sequence.arraySize} values${base} · ${sequence.widthMode}`;
}

export const radixSequenceListWorkspace = defineAuthorWorkspace<null>({
  id: "radix-sequences",
  matches: (route) => route.type === "feature" && route.feature === "radix" && route.workspace === "sequences",
  createDraft: () => null,
  buildSpec: ({ context }) => ({
    id: "radix-sequences",
    title: "SORT SEQUENCES",
    context: "Reusable sorting presentations. Startup, nodes, responses, commands, and rules can all reference the same sequence.",
    blocks: [{
      type: "custom",
      id: "radix-sequence-list",
      role: "results",
      content: <div className="definition-list">{context.snapshot.settings.radix.sequences.length
        ? context.snapshot.settings.radix.sequences.map((sequence) => <button
          type="button"
          key={sequence.id}
          onClick={() => context.pushTask({ type: "feature", feature: "radix", workspace: "sequence", data: { sequenceId: sequence.id } })}
        ><span>{sequence.label}</span><span>{sequenceDetail(sequence)}</span></button>)
        : <div className="workspace-empty">NO SORT SEQUENCES YET.</div>}
      </div>,
    }],
    actions: [{
      id: "new-radix-sequence",
      label: "+ SEQUENCE",
      onAction: () => context.pushTask({ type: "feature", feature: "radix", workspace: "sequence", data: { sequenceId: "new" } }),
    }],
  }),
});

export const radixSequenceEditorWorkspace = defineAuthorWorkspace<RadixSequenceDefinition>({
  id: "radix-sequence",
  matches: (route) => route.type === "feature" && route.feature === "radix" && route.workspace === "sequence",
  createDraft: (route, context) => {
    const id = route.data?.sequenceId ?? "new";
    const existing = context.snapshot.settings.radix.sequences.find((sequence) => sequence.id === id);
    return structuredClone(existing ?? createRadixSequence());
  },
  canSave: ({ draft }) => validSequence(draft),
  saveLabel: "SAVE",
  save: async ({ route, context, draft }) => {
    const sequences = context.snapshot.settings.radix.sequences.some((sequence) => sequence.id === draft.id)
      ? context.snapshot.settings.radix.sequences.map((sequence) => sequence.id === draft.id ? structuredClone(draft) : sequence)
      : [...context.snapshot.settings.radix.sequences, structuredClone(draft)];
    const settings = {
      ...context.snapshot.settings,
      radix: { ...context.snapshot.settings.radix, sequences },
    };
    const result = await context.persist([{ type: "project.settings", settings }], `Saved sort sequence ${draft.label}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    const resourceTask = route.data?.resourceTask;
    return {
      accepted: true,
      draft,
      ...(resourceTask ? {
        completion: {
          type: "resource" as const,
          kind: resourceTask,
          id: draft.id,
          value: draft.id,
          label: draft.label,
        },
      } : {}),
    };
  },
  buildSpec: ({ context, draft, setDraft }) => ({
    id: `radix-sequence-${draft.id}`,
    title: `SORT · ${draft.label || "NEW"}`,
    context: "A reusable deterministic sorting presentation. Random seeds vary per run; fixed number/text seeds reproduce the same starting universe.",
    blocks: [
      {
        type: "section",
        id: "radix-identity",
        label: "SEQUENCE",
        importance: "primary",
        children: [
          { type: "field", id: "radix-label", label: "LABEL", value: draft.label, onChange: (label) => setDraft({ ...draft, label }) },
          { type: "field", id: "radix-caption", label: "CAPTION", control: "textarea", rows: 2, value: draft.caption, onChange: (caption) => setDraft({ ...draft, caption }), help: "Player-facing text shown below every run of this sequence, including when this sequence is selected for app launch." },
          { type: "choice", id: "radix-width", label: "WIDTH", value: draft.widthMode, onChange: (widthMode) => setDraft({ ...draft, widthMode: widthMode === "terminal" ? "terminal" : "viewport" }), presentation: "segmented", options: [
            { value: "viewport", label: "VIEWPORT", help: "Use the full screen width." },
            { value: "terminal", label: "TERMINAL", help: "Lock to the player terminal content width." },
          ] },
        ],
      },
      {
        type: "section",
        id: "radix-sort",
        label: "SORT",
        children: [
          { type: "choice", id: "sort-algorithm", label: "ALGORITHM", value: draft.algorithm, onChange: (algorithm) => setDraft({ ...draft, algorithm: SORT_ALGORITHMS.some(([value]) => value === algorithm) ? algorithm as SortAlgorithm : "radix-lsd" }), presentation: "stacked", options: SORT_ALGORITHMS.map(([value, label]) => ({ value, label })) },
          { type: "field", id: "radix-array-size", label: "ARRAY SIZE", control: "number", inputMode: "numeric", value: draft.arraySize, onChange: (value) => setDraft({ ...draft, arraySize: numberValue(value, draft.arraySize, 8, 1024, true) }), help: "8–1024 values. More values create a denser visual and usually a longer performance." },
          ...(draft.algorithm === "radix-lsd" ? [{ type: "field" as const, id: "radix-base", label: "RADIX / BASE", control: "number" as const, inputMode: "numeric" as const, value: draft.radix, onChange: (value: string) => setDraft({ ...draft, radix: numberValue(value, draft.radix, 2, 16, true) }), help: "Base 4 approximates the Sound of Sorting LSD example." }] : []),
          { type: "field", id: "radix-delay", label: "EVENT DELAY (MS)", control: "number", inputMode: "decimal", value: draft.delayMs, onChange: (value) => setDraft({ ...draft, delayMs: numberValue(value, draft.delayMs, 0, 250) }) },
          { type: "field", id: "radix-hold", label: "FINISH HOLD (MS)", control: "number", inputMode: "numeric", value: draft.finishHoldMs, onChange: (value) => setDraft({ ...draft, finishHoldMs: numberValue(value, draft.finishHoldMs, 0, 10000) }) },
          { type: "choice", id: "radix-seed-mode", label: "SEED MODE", value: draft.seedMode, onChange: (seedMode) => setDraft({ ...draft, seedMode: seedMode === "number" || seedMode === "text" ? seedMode : "random" }), presentation: "stacked", options: [
            { value: "random", label: "RANDOM EACH RUN", help: "A fresh seed is generated whenever this sequence begins." },
            { value: "number", label: "FIXED NUMBER", help: "Repeat one exact shuffle from a numeric seed." },
            { value: "text", label: "FIXED TEXT", help: "Hash a phrase into a deterministic seed; the phrase itself remains authored project data." },
          ] },
          ...(draft.seedMode === "random" ? [] : [{ type: "field" as const, id: "radix-seed-value", label: draft.seedMode === "text" ? "SEED PHRASE" : "SEED NUMBER", value: draft.seedValue, onChange: (seedValue: string) => setDraft({ ...draft, seedValue }), help: draft.seedMode === "text" ? "The same phrase always produces the same initial disorder." : "The same number always produces the same initial disorder." }]),
        ],
      },
      {
        type: "disclosure",
        id: "radix-display",
        label: "DISPLAY",
        defaultOpen: false,
        children: [
          { type: "field", id: "radix-height", label: "MAX HEIGHT (PX)", control: "number", inputMode: "numeric", value: draft.heightPx, onChange: (value) => setDraft({ ...draft, heightPx: numberValue(value, draft.heightPx, 96, 1200, true) }), help: "The player surface also clamps height responsively on small screens." },
          { type: "toggle", id: "radix-algorithm-label", label: "SHOW ALGORITHM LABEL", checked: draft.showAlgorithmLabel, onChange: (showAlgorithmLabel) => setDraft({ ...draft, showAlgorithmLabel }) },
          { type: "toggle", id: "radix-stats", label: "SHOW ACCESS STATS", checked: draft.showStats, onChange: (showStats) => setDraft({ ...draft, showStats }) },
          { type: "field", id: "radix-bg", label: "BACKGROUND (#RRGGBB)", value: draft.backgroundColor, onChange: (backgroundColor) => setDraft({ ...draft, backgroundColor }) },
          { type: "field", id: "radix-bars", label: "BARS (#RRGGBB)", value: draft.barColor, onChange: (barColor) => setDraft({ ...draft, barColor }) },
          { type: "field", id: "radix-access", label: "ACCESS (#RRGGBB)", value: draft.accessColor, onChange: (accessColor) => setDraft({ ...draft, accessColor }) },
          { type: "field", id: "radix-markers", label: "MARKERS (#RRGGBB)", value: draft.markerColor, onChange: (markerColor) => setDraft({ ...draft, markerColor }) },
        ],
      },
      {
        type: "disclosure",
        id: "radix-sound",
        label: "SOUND",
        defaultOpen: true,
        children: [
          { type: "toggle", id: "radix-sound-enabled", label: "SOUND ENABLED", checked: draft.soundEnabled, onChange: (soundEnabled) => setDraft({ ...draft, soundEnabled }) },
          { type: "custom", id: "radix-synth", role: "resource-picker", content: <ReferenceField kind="synth-sound" value={draft.synthId} onChange={(synthId) => setDraft({ ...draft, synthId })} placeholder="Default triangle tone" /> },
          { type: "field", id: "radix-min-frequency", label: "MIN FREQUENCY (HZ)", control: "number", inputMode: "decimal", value: draft.minFrequency, onChange: (value) => setDraft({ ...draft, minFrequency: numberValue(value, draft.minFrequency, 20, 12000) }) },
          { type: "field", id: "radix-max-frequency", label: "MAX FREQUENCY (HZ)", control: "number", inputMode: "decimal", value: draft.maxFrequency, onChange: (value) => setDraft({ ...draft, maxFrequency: numberValue(value, draft.maxFrequency, draft.minFrequency, 16000) }) },
          { type: "field", id: "radix-volume", label: "VOLUME (0–1)", control: "number", inputMode: "decimal", value: draft.volume, onChange: (value) => setDraft({ ...draft, volume: numberValue(value, draft.volume, 0, 1) }), help: "The selected synth's first pitched voice supplies waveform and envelope." },
          { type: "field", id: "radix-tone-stride", label: "TONE EVERY N EVENTS", control: "number", inputMode: "numeric", value: draft.toneStride, onChange: (value) => setDraft({ ...draft, toneStride: numberValue(value, draft.toneStride, 1, 64, true) }), help: "Increase this if a device struggles with very dense sonification." },
        ],
      },
      {
        type: "custom",
        id: "radix-live-preview",
        role: "preview",
        content: <button type="button" onClick={() => context.runtime.events([{ type: "radix", sequenceId: draft.id }])}>[PREVIEW SAVED VERSION ON PLAYER SURFACE]</button>,
      },
    ],
  }),
});

function RadixStartupSettings({ context }: { context: Parameters<AuthorProjectSettingsSection["render"]>[0] }) {
  const [enabled, setEnabled] = useState(context.snapshot.settings.radix.startup.enabled);
  const [sequenceId, setSequenceId] = useState(context.snapshot.settings.radix.startup.sequenceId);
  const [saving, setSaving] = useState(false);
  const baseline = context.snapshot.settings.radix.startup;
  const dirty = useMemo(() => enabled !== baseline.enabled || sequenceId !== baseline.sequenceId, [baseline.enabled, baseline.sequenceId, enabled, sequenceId]);

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const save = async () => {
    setSaving(true);
    try {
      const settings = {
        ...context.snapshot.settings,
        radix: {
          ...context.snapshot.settings.radix,
          startup: { enabled, sequenceId },
        },
      };
      const result = await context.persist([{ type: "project.settings", settings }], "Changed player launch sort sequence");
      if (result.status === "saved" || result.status === "queued") context.setWorkspaceDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return <div className="project-setting-card">
    <h3>PLAYER LAUNCH</h3>
    <p className="project-settings-description">Run one reusable sort sequence once whenever the player app opens, before the saved-game choice or normal play is revealed. It does not count as entering a node. The selected sequence's own CAPTION is shown beneath it.</p>
    <label className="check-label"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> enabled on app launch</label>
    <ReferenceField kind="radix-sequence" value={sequenceId} onChange={setSequenceId} placeholder="Choose launch sequence" />
    <div className="project-setting-actions">
      <button type="button" disabled={!dirty || saving || (enabled && !sequenceId)} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
      {sequenceId ? <button type="button" onClick={() => context.runtime.events([{ type: "radix", sequenceId }])}>[PREVIEW]</button> : null}
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "radix", workspace: "sequences" })}>[OPEN SORT SEQUENCES]</button>
    </div>
  </div>;
}

export const RADIX_PROJECT_SETTINGS: readonly AuthorProjectSettingsSection[] = [{
  id: "radix-startup",
  label: "LAUNCH SEQUENCE",
  description: "Choose whether a reusable sort presentation runs once when the player app opens.",
  order: 20,
  render: (context) => <RadixStartupSettings context={context} />,
}];
