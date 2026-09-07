import type { EffectAuthorAdapter } from "../../../author/rules/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { configuredAssetStore } from "../ui/assetStore";

export const synthEffectAdapter: EffectAuthorAdapter = {
  type: "synth",
  label: "play synth",
  category: "audio & image",
  description: "Play a reusable authored Synth.",
  create: () => ({ id: crypto.randomUUID(), type: "synth", synthId: "" }),
  references: (effect) => effect.type === "synth" && effect.synthId ? [{ resourceKind: "synth-sound", resourceId: effect.synthId, detail: "synth effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "synth"
    ? `Play Synth: ${snapshot.synthSounds.find((synth) => synth.id === effect.synthId)?.label || "choose Synth"}`
    : "Play Synth",
  previewEvents: (effect) => effect.type === "synth" ? [{ type: "synth", synthId: effect.synthId }] : [],
  render: ({ effect, onChange }) => effect.type === "synth"
    ? <ReferenceField kind="synth-sound" value={effect.synthId} onChange={(synthId) => onChange({ ...effect, synthId })} />
    : null,
};

export const audioEffectAdapter: EffectAuthorAdapter = {
  type: "audio",
  label: "play audio",
  category: "audio & image",
  description: "Play either a procedural Synth or an audio file shipped in public/assets.",
  create: () => ({ id: crypto.randomUUID(), type: "audio", assetId: "" }),
  // "audio" is the persisted prototype effect name. Its reference is now the
  // author-facing audio-source union rather than pretending every source is a file.
  references: (effect) => effect.type === "audio" && effect.assetId
    ? [{ resourceKind: "media-sound", resourceId: effect.assetId, detail: "audio effect" }]
    : [],
  summarize: (effect, snapshot) => {
    if (effect.type !== "audio") return "Play audio";
    const synth = snapshot.synthSounds.find((candidate) => candidate.id === effect.assetId);
    if (synth) return `Play audio: ${synth.label || synth.key} · Synth`;
    const asset = configuredAssetStore.resolve(snapshot, effect.assetId);
    if (!asset) return "Play audio: choose source";
    return `Play audio: ${asset.name}${asset.available ? "" : " [MISSING REPOSITORY FILE]"}`;
  },
  previewEvents: (effect) => effect.type === "audio" ? [{ type: "audio", assetId: effect.assetId }] : [],
  render: ({ effect, onChange }) => effect.type === "audio"
    ? <ReferenceField kind="media-sound" value={effect.assetId} onChange={(assetId) => onChange({ ...effect, assetId })} />
    : null,
};

export const artEffectAdapter: EffectAuthorAdapter = {
  type: "art",
  label: "show sprite/art",
  category: "audio & image",
  description: "Show an authored image or sprite.",
  create: () => ({ id: crypto.randomUUID(), type: "art", assetId: "" }),
  references: (effect) => effect.type === "art" && effect.assetId ? [{ resourceKind: "media-image", resourceId: effect.assetId, detail: "image effect" }] : [],
  summarize: (effect, snapshot) => {
    if (effect.type !== "art") return "Show sprite/art";
    const asset = configuredAssetStore.resolve(snapshot, effect.assetId);
    if (!asset) return "Show art: choose image";
    return `Show art: ${asset.name}${asset.available ? "" : " [MISSING REPOSITORY FILE]"}`;
  },
  previewEvents: (effect) => effect.type === "art" ? [{ type: "art", assetId: effect.assetId }] : [],
  render: ({ effect, onChange }) => effect.type === "art"
    ? <ReferenceField kind="media-image" value={effect.assetId} onChange={(assetId) => onChange({ ...effect, assetId })} />
    : null,
};