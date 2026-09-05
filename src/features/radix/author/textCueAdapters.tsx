import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { TextCueAuthorAdapter } from "../../../author/textCues/types";

export const RADIX_TEXT_CUE_AUTHOR_ADAPTERS: readonly TextCueAuthorAdapter[] = [{
  type: "radix",
  inlineCode: "radix",
  label: "Sort sequence",
  category: "PRESENTATION",
  description: "Run a reusable sort sequence when delivery reaches this point in node or response text.",
  references: (value) => value.trim()
    ? [{ resourceKind: "radix-sequence", resourceId: value.trim(), detail: "inline sort presentation cue" }]
    : [],
  renderValue: ({ value, onValueChange }) => <ReferenceField
    kind="radix-sequence"
    value={value.trim()}
    onChange={onValueChange}
    allowEmpty={false}
  />,
}];
