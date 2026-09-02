import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { TextCueAuthorAdapter } from "../../../author/textCues/types";

const synth: TextCueAuthorAdapter = {
  type: "synth",
  label: "synth",
  createValue: () => "",
  references: (cue) => String(cue.value ?? "") ? [{ resourceKind: "synth-sound", resourceId: String(cue.value), detail: "inline synth cue" }] : [],
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
    references: (cue) => String(cue.value ?? "") ? [{ resourceKind, resourceId: String(cue.value), detail: `inline ${type} cue` }] : [],
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
