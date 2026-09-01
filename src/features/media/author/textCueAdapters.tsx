import type { TextCueAuthorAdapter } from "../../../author/textCues/types";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";

const synth: TextCueAuthorAdapter = {
  type: "synth",
  label: "synth",
  createValue: () => "",
  renderValue: ({ cue, snapshot, onValueChange }) => <select
    aria-label="Synth cue sound"
    value={String(cue.value ?? "")}
    onChange={(event) => onValueChange(event.target.value)}
  >
    <option value="">choose synth</option>
    {snapshot.synthSounds.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
  </select>,
};

function assetCue(type: "audio" | "sprite", assetType: "audio" | "image"): TextCueAuthorAdapter {
  return {
    type,
    label: type,
    createValue: () => "",
    renderValue: ({ cue, onValueChange }) => <select
      aria-label={`${type} cue asset`}
      value={String(cue.value ?? "")}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">choose asset</option>
      {ASSET_MANIFEST
        .filter((asset) => asset.runtimePath && asset.type === assetType)
        .map((asset) => <option key={asset.path} value={asset.runtimePath!}>{asset.path}</option>)}
    </select>,
  };
}

export const MEDIA_TEXT_CUE_AUTHOR_ADAPTERS: readonly TextCueAuthorAdapter[] = [
  synth,
  assetCue("audio", "audio"),
  assetCue("sprite", "image"),
];
