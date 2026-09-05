import type { EffectAuthorAdapter } from "../../../author/rules/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";

export const radixEffectAdapter: EffectAuthorAdapter = {
  type: "radix",
  label: "run sort sequence",
  category: "presentation",
  description: "Run a reusable authored sorting visualization and procedural sound sequence.",
  create: () => ({ id: crypto.randomUUID(), type: "radix", sequenceId: "" }),
  references: (effect) => effect.type === "radix" && effect.sequenceId
    ? [{ resourceKind: "radix-sequence", resourceId: effect.sequenceId, detail: "sort presentation effect" }]
    : [],
  summarize: (effect, snapshot) => effect.type === "radix"
    ? `Sort: ${snapshot.settings.radix.sequences.find((sequence) => sequence.id === effect.sequenceId)?.label || "choose sequence"}`
    : "Run sort sequence",
  previewEvents: (effect) => effect.type === "radix" ? [{ type: "radix", sequenceId: effect.sequenceId }] : [],
  render: ({ effect, onChange }) => effect.type === "radix"
    ? <ReferenceField kind="radix-sequence" value={effect.sequenceId} onChange={(sequenceId) => onChange({ ...effect, sequenceId })} />
    : null,
};
