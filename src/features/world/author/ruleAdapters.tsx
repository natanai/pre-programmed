import type { EffectAuthorAdapter } from "../../../author/rules/types";

export const targetDescriptionEffectAdapter: EffectAuthorAdapter = {
  type: "world_target_description",
  label: "show target description",
  category: "target",
  description: "Append this World interaction target's current Description to the player transcript.",
  targetKinds: ["world.character", "world.location"],
  create: () => ({ id: crypto.randomUUID(), type: "world_target_description" }),
  summarize: () => "Read the target's current Description at runtime",
  render: () => <p>Uses the current interaction target. The description is not copied into this response.</p>,
};

export const targetPortraitEffectAdapter: EffectAuthorAdapter = {
  type: "world_target_portrait",
  label: "show target portrait",
  category: "target",
  description: "Open this Character's current Portrait in the player media viewer.",
  targetKinds: ["world.character"],
  create: () => ({ id: crypto.randomUUID(), type: "world_target_portrait" }),
  summarize: () => "Open the target Character's current Portrait at runtime",
  render: () => <p>Uses the current Character's Portrait reference. The Media asset is not copied into this response.</p>,
};
