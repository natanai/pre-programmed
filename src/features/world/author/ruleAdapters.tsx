import type { EffectAuthorAdapter } from "../../../author/rules/types";
import { AuthorHelp } from "../../../author/ui/AuthorHelp";

export const targetDescriptionEffectAdapter: EffectAuthorAdapter = {
  type: "world_target_description",
  label: "show target description",
  category: "target",
  description: "Append this World interaction target's current Description to the player transcript.",
  targetKinds: ["world.character", "world.location"],
  create: () => ({ id: crypto.randomUUID(), type: "world_target_description" }),
  summarize: () => "Read the target's current Description at runtime",
  render: () => <div className="author-ui-field-heading"><span>CURRENT TARGET DESCRIPTION</span><AuthorHelp label="About target descriptions" text="At runtime, this reads the Description from the Character or Location targeted by the interaction. It is not copied into the response." /></div>,
};

export const targetPortraitEffectAdapter: EffectAuthorAdapter = {
  type: "world_target_portrait",
  label: "show target portrait",
  category: "target",
  description: "Open this Character's current Portrait in the player media viewer.",
  targetKinds: ["world.character"],
  create: () => ({ id: crypto.randomUUID(), type: "world_target_portrait" }),
  summarize: () => "Open the target Character's current Portrait at runtime",
  render: () => <div className="author-ui-field-heading"><span>CURRENT CHARACTER PORTRAIT</span><AuthorHelp label="About target portraits" text="At runtime, this uses the targeted Character’s current Portrait, rather than copying an image into the response." /></div>,
};
