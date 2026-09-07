import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { TextCueAuthorAdapter } from "../../../author/textCues/types";

const synthCommand: TextCueAuthorAdapter = {
  type: "synth",
  inlineCode: "synth",
  label: "Synth",
  category: "MEDIA",
  description: "Play a Synth when delivery reaches this point.",
  references: (value, snapshot) => {
    const token = value.trim();
    if (!token) return [];
    const synth = snapshot.synthSounds.find((candidate) => candidate.id === token || candidate.key === token);
    return [{ resourceKind: "synth-sound", resourceId: synth?.id ?? token, detail: "inline /synth command" }];
  },
  renderValue: ({ value, snapshot, onValueChange }) => {
    const token = value.trim();
    const synth = snapshot.synthSounds.find((candidate) => candidate.id === token || candidate.key === token);
    return <ReferenceField
      kind="synth-sound"
      value={synth?.id ?? token}
      onChange={(nextValue) => {
        const nextSynth = snapshot.synthSounds.find((candidate) => candidate.id === nextValue || candidate.key === nextValue);
        onValueChange(nextSynth?.key || nextValue);
      }}
      allowEmpty={false}
    />;
  },
};

function resourceCommand(
  type: "audio" | "sprite",
  resourceKind: "media-audio" | "media-image",
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
  synthCommand,
  resourceCommand("audio", "media-audio", "Audio", "Play a repository audio file when delivery reaches this point."),
  resourceCommand("sprite", "media-image", "Sprite", "Show an image asset when delivery reaches this point."),
];
