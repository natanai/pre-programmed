import type { DerivedValueProvider } from "../../engine/values/derivedValue";

export const NARRATIVE_DERIVED_VALUE_PROVIDER: DerivedValueProvider = {
  id: "narrative",
  label: "Narrative",
  metrics: [{ id: "visited_nodes", label: "Visited nodes" }],
  read(metric, _snapshot, state) {
    return metric === "visited_nodes" ? new Set(state.visitedNodeIds).size : undefined;
  },
};
