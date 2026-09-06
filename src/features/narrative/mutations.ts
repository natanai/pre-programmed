import type { GameNode, Interaction } from "./model";

/** Project mutation payloads owned by the Narrative feature. */
export type NarrativeMutationOperation =
  | { type: "node.upsert"; node: GameNode }
  | { type: "interaction.upsert"; interaction: Interaction }
  | { type: "interaction.reorder"; sourceNodeId: string; interactionIds: string[] }
  | { type: "interaction.delete"; id: string };
