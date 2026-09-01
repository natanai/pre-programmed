export type NarrativeCondition =
  | { type: "visited"; nodeId: string; value: boolean };

export type NarrativeEffect =
  | { id: string; type: "set_interaction_visibility"; interactionId: string; visible: boolean }
  | { id: string; type: "transition"; nodeId: string };
