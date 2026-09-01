import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { TextCueAuthorAdapter } from "../../../author/textCues/types";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";

const synth: TextCueAuthorAdapter = {
  type: "synth",
  label: "synth",
  createValue: () => "",
  renderValue: ({ cue, onValueChange }) => <ReferenceField
    kind="synth-sound"
    value={String(cue.value ?? "")}
    onChange={onValueChange}
  />,
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
