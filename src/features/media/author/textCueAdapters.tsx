import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { TextCueAuthorAdapter } from "../../../author/textCues/types";

function resourceCommand(
  type: "synth" | "audio" | "sprite",
  resourceKind: "synth-sound" | "media-audio" | "media-image",
  label: string,
  description: string,
): TextCueAuthorAdapter {
  return {
    type,
    inlineCode: type,
    label,
    category: "MEDIA",
    description,
    references: (value) => value.trim() ? [{ resourceKind, resourceId: value.trim(), detail: `inline /${type} command` }] : [],
    renderValue: ({ value, onValueChange }) => <ReferenceField
      kind={resourceKind}
      value={value}
      onChange={onValueChange}
      allowEmpty={false}
    />,
  };
}

export const MEDIA_TEXT_CUE_AUTHOR_ADAPTERS: readonly TextCueAuthorAdapter[] = [
  resourceCommand("synth", "synth-sound", "Synth", "Play a synth sound when delivery reaches this point."),
  resourceCommand("audio", "media-audio", "Audio", "Play an audio asset when delivery reaches this point."),
  resourceCommand("sprite", "media-image", "Sprite", "Show an image asset when delivery reaches this point."),
];
