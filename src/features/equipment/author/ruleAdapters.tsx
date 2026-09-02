import type { EffectAuthorAdapter } from "../../../author/rules/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";

export const setBodyTypeEffectAdapter: EffectAuthorAdapter = {
  type: "set_body_background",
  label: "set body type",
  category: "equipment",
  description: "Change the active body/equipment layout.",
  create: () => ({ id: crypto.randomUUID(), type: "set_body_background", backgroundId: "" }),
  references: (effect) => effect.type === "set_body_background" && effect.backgroundId ? [{ resourceKind: "body-type", resourceId: effect.backgroundId, detail: "body type effect" }] : [],
  summarize: (effect, snapshot) => effect.type === "set_body_background"
    ? `Body type → ${snapshot.bodyTypes.find((item) => item.id === effect.backgroundId)?.name || "choose"}`
    : "Set body type",
  render: ({ effect, onChange }) => effect.type === "set_body_background"
    ? <ReferenceField kind="body-type" value={effect.backgroundId} onChange={(backgroundId) => onChange({ ...effect, backgroundId })} />
    : null,
};
