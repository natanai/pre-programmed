import { normalizeAuthorKey } from "../../../author/generatedKey";
import { resolveAuthorKey } from "../../../author/generatedKey";
import { referencesTo } from "../../../author/references/projectReferences";
import type { AuthorUiAction, AuthorUiNode } from "../../../author/ui/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { SynthSound } from "../model";
import {
  applySynthPreset,
  createStarterSynth,
  SYNTH_PRESET_IDS,
  synthSequenceLength,
  type SynthPresetId,
  validateSynth,
} from "../synth";
import { playSynthSound } from "../ui/synthPlayback";
import { SynthSequencer } from "./SynthSequencer";

type SynthSoundWorkspaceDraft = {
  sound: SynthSound;
  saving: boolean;
  saveError: string;
};

function synthSignature(draft: SynthSoundWorkspaceDraft) {
  return JSON.stringify(draft.sound);
}

export const synthSoundWorkspace = defineAuthorWorkspace<SynthSoundWorkspaceDraft>({
  id: "media-synth-sound",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "synth-sound",
  createDraft: (route, context) => {
    const soundId = route.data?.soundId ?? "new";
    const existing = soundId === "new"
      ? undefined
      : context.snapshot.synthSounds.find((candidate) => candidate.id === soundId);
    return {
      sound: structuredClone(existing ?? { ...createStarterSynth(), key: "", label: "" }),
      saving: false,
      saveError: "",
    };
  },
  signature: synthSignature,
  canSave: ({ draft }) => !draft.saving && Boolean(draft.sound.label.trim()) && validateSynth(draft.sound).length === 0,
  save: async ({ route, context, draft, setDraft }) => {
    if (!draft.sound.label.trim() || validateSynth(draft.sound).length) return { accepted: false };

    const persisted = context.snapshot.synthSounds.some((candidate) => candidate.id === draft.sound.id);
    const sound: SynthSound = {
      ...draft.sound,
      label: draft.sound.label.trim(),
      key: resolveAuthorKey({
        override: draft.sound.key,
        source: draft.sound.label,
        existingKeys: context.snapshot.synthSounds
          .filter((candidate) => candidate.id !== draft.sound.id)
          .map((candidate) => candidate.key),
        fallback: "sound",
      }),
    };

    setDraft((current) => ({ ...current, sound, saving: true, saveError: "" }));
    const result = await context.persist(
      [{ type: "synth.upsert", sound }],
      `${persisted ? "Changed" : "Created"} synth ${sound.label}`,
    );
    if (result.status !== "saved" && result.status !== "queued") {
      setDraft((current) => ({
        ...current,
        saving: false,
        saveError: result.status === "conflict"
          ? "The project changed while this sound was saving. Your draft is still here; save it again."
          : result.message ?? "This sound could not be saved. Your draft is still here.",
      }));
      return { accepted: false };
    }

    const savedDraft: SynthSoundWorkspaceDraft = { sound, saving: false, saveError: "" };
    const resourceKind = route.data?.resourceTask;
    return {
      accepted: true,
      draft: savedDraft,
      ...(resourceKind ? {
        completion: {
          type: "resource" as const,
          kind: resourceKind,
          id: sound.id,
          value: sound.id,
          label: sound.label || sound.key || "Untitled sound",
        },
      } : {}),
    };
  },
  buildSpec: ({ context, draft, setDraft }) => {
    const sound = draft.sound;
    const persisted = context.snapshot.synthSounds.find((candidate) => candidate.id === sound.id);
    const usages = persisted ? [
      ...referencesTo(context.snapshot, "synth-sound", sound.id),
      ...referencesTo(context.snapshot, "media-sound", sound.id),
    ] : [];
    const validationErrors = validateSynth(sound);
    const generatedKey = normalizeAuthorKey(sound.label) || "generated-on-save";
    const sequenceLength = synthSequenceLength(sound);

    const changeSound = (next: SynthSound) => setDraft((current) => ({
      ...current,
      sound: next,
      saveError: "",
    }));

    const applyPreset = (preset: SynthPresetId) => {
      const next = applySynthPreset(sound, preset);
      changeSound(next);
      void playSynthSound(next);
    };

    const remove = async () => {
      if (!persisted || usages.length || draft.saving) return;
      if (!window.confirm(`Delete synth sound “${persisted.label}”?`)) return;
      setDraft((current) => ({ ...current, saving: true, saveError: "" }));
      const result = await context.persist([{ type: "synth.delete", id: persisted.id }], `Deleted synth ${persisted.label}`);
      if (result.status === "saved" || result.status === "queued") {
        context.leaveCurrentTask();
        return;
      }
      setDraft((current) => ({
        ...current,
        saving: false,
        saveError: result.status === "conflict"
          ? "The project changed while this sound was being deleted. Nothing was removed."
          : result.message ?? "This sound could not be deleted.",
      }));
    };

    const blocks: AuthorUiNode[] = [
      {
        type: "section",
        id: "synth-recipe",
        label: "Recipe",
        importance: "primary",
        children: [
          {
            type: "field",
            id: "synth-label",
            label: "Label",
            value: sound.label,
            autoFocus: !persisted,
            onChange: (label) => changeSound({ ...sound, label }),
          },
          {
            type: "field",
            id: "synth-tempo",
            label: "Tempo",
            control: "number",
            value: sound.tempo,
            min: 30,
            max: 300,
            step: 1,
            onChange: (tempo) => changeSound({ ...sound, tempo: Number(tempo) }),
          },
          {
            type: "toggle",
            id: "synth-loop",
            label: "Loop recipe",
            checked: sound.loop,
            onChange: (loop) => changeSound({ ...sound, loop }),
          },
          {
            type: "disclosure",
            id: "synth-identifier",
            label: "Advanced identifier",
            summary: sound.key || generatedKey,
            children: [{
              type: "field",
              id: "synth-key",
              label: "Key",
              value: sound.key,
              placeholder: generatedKey,
              autoCapitalize: "none",
              autoCorrect: "off",
              spellCheck: false,
              help: sound.key
                ? "Stable internal key. Change only when you intentionally need a different identifier."
                : `Generated automatically from the label: ${generatedKey}`,
              onChange: (key) => changeSound({ ...sound, key: normalizeAuthorKey(key) }),
            }],
          },
        ],
      },
      {
        type: "section",
        id: "synth-quick-start",
        label: "Sound palettes",
        summary: `${sound.voices.length} voice${sound.voices.length === 1 ? "" : "s"} · ${sequenceLength} steps`,
        children: [{
          type: "action-row",
          id: "synth-presets",
          actions: SYNTH_PRESET_IDS.map((preset) => ({
            id: `synth-preset:${preset}`,
            label: preset.toUpperCase(),
            onAction: () => applyPreset(preset),
          })),
        }],
      },
      {
        type: "disclosure",
        id: "synth-advanced",
        label: "Voices + sequence",
        summary: `${sound.voices.length} voice${sound.voices.length === 1 ? "" : "s"} · ${sequenceLength} steps`,
        children: [{
          type: "custom",
          id: "synth-sequencer",
          role: "specialized-control",
          content: <SynthSequencer sound={sound} onChange={changeSound} />,
        }],
      },
      ...validationErrors.map((error, index) => ({
        type: "status" as const,
        id: `synth-validation:${index}`,
        tone: "error" as const,
        text: error,
      })),
      ...(draft.saveError ? [{
        type: "status" as const,
        id: "synth-save-error",
        tone: "error" as const,
        text: draft.saveError,
      }] : []),
    ];

    const actions: AuthorUiAction[] = [{
      id: "synth-play",
      label: "PLAY",
      onAction: () => { void playSynthSound(sound); },
    }];
    if (persisted) actions.push({
      id: "synth-delete",
      label: `DELETE${usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}`,
      tone: "danger",
      disabled: draft.saving || usages.length > 0,
      onAction: () => { void remove(); },
    });

    return {
      id: "media-synth-sound",
      title: `Synth sound · ${sound.label || "New"}`,
      context: `${sound.voices.length} voice${sound.voices.length === 1 ? "" : "s"} · ${sound.tempo} BPM`,
      blocks,
      actions,
    };
  },
});
