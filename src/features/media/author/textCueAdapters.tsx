import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { TextCueAuthorAdapter } from "../../../author/textCues/types";

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

function assetCue(type: "audio" | "sprite", resourceKind: "media-audio" | "media-image"): TextCueAuthorAdapter {
  return {
    type,
    label: type,
    createValue: () => "",
    renderValue: ({ cue, onValueChange }) => <ReferenceField
      kind={resourceKind}
      value={String(cue.value ?? "")}
      onChange={onValueChange}
    />,
  };
}

export const MEDIA_TEXT_CUE_AUTHOR_ADAPTERS: readonly TextCueAuthorAdapter[] = [
  synth,
  assetCue("audio", "media-audio"),
  assetCue("sprite", "media-image"),
];
