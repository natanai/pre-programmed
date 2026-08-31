import type { ConditionAuthorAdapter, EffectAuthorAdapter } from "../../../author/rules/types";
import { DefinitionSelect } from "../../../author/rules/controls";

export const visitedConditionAdapter: ConditionAuthorAdapter = {
  type: "visited",
  label: "visited node",
  create: () => ({ type: "visited", nodeId: "", value: true }),
  render: ({ condition, onChange, snapshot }) => {
    if (condition.type !== "visited") return null;
    return <>
      <select value={condition.nodeId} onChange={(event) => onChange({ ...condition, nodeId: event.target.value })}>
        <option value="">choose node</option>
        {snapshot.nodes.map((node) => <option value={node.id} key={node.id}>#{node.nodeNumber} {node.text.slice(0, 40)}</option>)}
      </select>
      <select value={String(condition.value)} onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}>
        <option value="true">visited</option><option value="false">unvisited</option>
      </select>
    </>;
  },
};

export const interactionVisibilityEffectAdapter: EffectAuthorAdapter = {
  type: "set_interaction_visibility",
  label: "show/hide interaction",
  create: () => ({ id: crypto.randomUUID(), type: "set_interaction_visibility", interactionId: "", visible: true }),
  render: ({ effect, onChange, snapshot }) => effect.type === "set_interaction_visibility" ? <>
    <DefinitionSelect value={effect.interactionId} definitions={snapshot.interactions} valueMode="id" onChange={(interactionId) => onChange({ ...effect, interactionId })} />
    <select value={String(effect.visible)} onChange={(event) => onChange({ ...effect, visible: event.target.value === "true" })}><option value="true">show</option><option value="false">hide</option></select>
  </> : null,
};

export const transitionEffectAdapter: EffectAuthorAdapter = {
  type: "transition",
  label: "transition",
  create: () => ({ id: crypto.randomUUID(), type: "transition", nodeId: "" }),
  render: ({ effect, onChange, snapshot }) => effect.type === "transition"
    ? <select value={effect.nodeId} onChange={(event) => onChange({ ...effect, nodeId: event.target.value })}><option value="">choose node</option>{snapshot.nodes.map((node) => <option value={node.id} key={node.id}>#{node.nodeNumber} {node.text.slice(0, 40)}</option>)}</select>
    : null,
};
