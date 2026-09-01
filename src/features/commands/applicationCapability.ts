export type ApplicationCommandAction = {
  type: "open-workspace";
  feature: string;
  workspace: string;
  data?: Record<string, string>;
};

/**
 * A shell-level capability that authored targetless grammar may invoke.
 *
 * The operation ID is stable module vocabulary; player-facing words are
 * project grammar and never live here. Actions are generic shell requests so
 * Commands does not need to know what Inventory, Help, Save, etc. mean.
 */
export type ApplicationCommandCapability = {
  operation: string;
  label: string;
  description: string;
  action: ApplicationCommandAction;
};
