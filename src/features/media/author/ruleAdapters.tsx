import type { EffectAuthorAdapter } from "../../../author/rules/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { configuredAssetStore } from "../ui/assetStore";

export const synthEffectAdapter: EffectAuthorAdapter = {
  type: "synth",
  label: "play synth",
  category: "sound & image",
  description: "Play a reusable authored synth sound.",
  create: () => ({ id: crypto.randomUUID(), type: "synth", synthId: "" }),
  summarize: (effect, snapshot) => effect.type === "synth"
    ? `Play synth: ${snapshot.synthSounds.find((sound) => sound.id === effect.synthId)?.label || "choose synth"}`
    : "Play synth",
  previewEvents: (effect) => effect.type === "synth" ? [{ type: "synth", synthId: effect.synthId }] : [],
  render: ({ effect, onChange }) => effect.type === "synth"
    ? <ReferenceField kind="synth-sound" value={effect.synthId} onChange={(synthId) => onChange({ ...effect, synthId })} />
    : null,
};

export const audioEffectAdapter: EffectAuthorAdapter = {
  type: "audio",
  label: "play sound",
  category: "sound & image",
  description: "Play an authored or repository audio asset.",
  create: () => ({ id: crypto.randomUUID(), type: "audio", assetId: "" }),
  summarize: (effect, snapshot) => effect.type === "audio" ? `Play audio: ${configuredAssetStore.resolve(snapshot, effect.assetId)?.name ?? "choose sound"}` : "Play sound",
  previewEvents: (effect) => effect.type === "audio" ? [{ type: "audio", assetId: effect.assetId }] : [],
  render: ({ effect, onChange }) => effect.type === "audio"
    ? <ReferenceField kind="media-audio" value={effect.assetId} onChange={(assetId) => onChange({ ...effect, assetId })} />
    : null,
};

export const artEffectAdapter: EffectAuthorAdapter = {
  type: "art",
  label: "show sprite/art",
  category: "sound & image",
  description: "Show an authored image or sprite.",
  create: () => ({ id: crypto.randomUUID(), type: "art", assetId: "" }),
  summarize: (effect, snapshot) => effect.type === "art" ? `Show art: ${configuredAssetStore.resolve(snapshot, effect.assetId)?.name ?? "choose image"}` : "Show sprite/art",
  previewEvents: (effect) => effect.type === "art" ? [{ type: "art", assetId: effect.assetId }] : [],
  render: ({ effect, onChange }) => effect.type === "art"
    ? <ReferenceField kind="media-image" value={effect.assetId} onChange={(assetId) => onChange({ ...effect, assetId })} />
    : null,
};
