import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";

export const visitedConditionAdapter: ConditionAuthorAdapter = {
  type: "visited",
  label: "visited node",
  create: () => ({ type: "visited", nodeId: "", value: true }),
  references: (condition) => condition.type === "visited" && condition.nodeId ? [{ resourceKind: "node", resourceId: condition.nodeId, detail: "visited node" }] : [],
  render: ({ condition, onChange }) => {
    if (condition.type !== "visited") return null;
    return <>
      <ReferenceField kind="node" value={condition.nodeId} onChange={(nodeId) => onChange({ ...condition, nodeId })} />
      <select value={String(condition.value)} onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}>
        <option value="true">visited</option><option value="false">unvisited</option>
      </select>
    </>;
  },
};

export const interactionVisibilityEffectAdapter: EffectAuthorAdapter = {
  type: "set_interaction_visibility",
  label: "show/hide player choice",
  category: "narrative",
  description: "Change whether another authored input is suggested as a player choice. Typing that input still works.",
  create: () => ({ id: crypto.randomUUID(), type: "set_interaction_visibility", interactionId: "", visible: true }),
  references: (effect) => effect.type === "set_interaction_visibility" && effect.interactionId ? [{ resourceKind: "interaction", resourceId: effect.interactionId, detail: "interaction visibility target" }] : [],
  summarize: (effect, snapshot) => {
    if (effect.type !== "set_interaction_visibility") return "Show/hide player choice";
    const interaction = snapshot.interactions.find((item) => item.id === effect.interactionId);
    const label = interaction?.wording || interaction?.aliases[0] || "choose interaction";
    return `${effect.visible ? "Show" : "Hide"} choice “${label}”`;
  },
  render: ({ effect, onChange }) => effect.type === "set_interaction_visibility" ? <>
    <ReferenceField kind="interaction" value={effect.interactionId} onChange={(interactionId) => onChange({ ...effect, interactionId })} />
    <select value={String(effect.visible)} onChange={(event) => onChange({ ...effect, visible: event.target.value === "true" })}><option value="true">show choice</option><option value="false">hide choice</option></select>
  </> : null,
};

export const transitionEffectAdapter: EffectAuthorAdapter = {
  type: "transition",
  label: "transition",
  category: "narrative",
  description: "Move play to another node after this outcome.",
  create: () => ({ id: crypto.randomUUID(), type: "transition", nodeId: "" }),
  references: (effect) => effect.type === "transition" && effect.nodeId ? [{ resourceKind: "node", resourceId: effect.nodeId, detail: "transition destination" }] : [],
  summarize: (effect, snapshot) => {
    if (effect.type !== "transition") return "Transition";
    const node = snapshot.nodes.find((item) => item.id === effect.nodeId);
    return node ? `Go to Node #${node.nodeNumber}` : "Choose destination node";
  },
  render: ({ effect, onChange }) => effect.type === "transition"
    ? <ReferenceField kind="node" value={effect.nodeId} onChange={(nodeId) => onChange({ ...effect, nodeId })} />
    : null,
};
