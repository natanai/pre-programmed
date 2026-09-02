import type { EffectAuthorAdapter } from "../../../author/rules/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";

export const setBodyTypeEffectAdapter: EffectAuthorAdapter = {
  type: "set_body_type",
  label: "set body type",
  category: "equipment",
  description: "Change the active body/equipment layout.",
  create: () => ({ id: crypto.randomUUID(), type: "set_body_type", bodyTypeId: "" }),
  references: (effect) => effect.type === "set_body_type" && effect.bodyTypeId
    ? [{ resourceKind: "body-type", resourceId: effect.bodyTypeId, detail: "body type effect" }]
    : [],
  summarize: (effect, snapshot) => effect.type === "set_body_type"
    ? `Body type → ${snapshot.bodyTypes.find((item) => item.id === effect.bodyTypeId)?.name || "choose"}`
    : "Set body type",
  render: ({ effect, onChange }) => effect.type === "set_body_type"
    ? <ReferenceField kind="body-type" value={effect.bodyTypeId} onChange={(bodyTypeId) => onChange({ ...effect, bodyTypeId })} />
    : null,
};
