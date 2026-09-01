export type ApplicationCommandAction = {
  type: "open-workspace";
  feature: string;
  workspace: string;
  data?: Record<string, string>;
};

/**
 * A shell-level capability that authored targetless command grammar may invoke.
 *
 * The operation ID is stable module vocabulary; player-facing words remain
 * project grammar. Actions stay generic so the application shell never needs
 * to know what Inventory, Help, Save, or another feature means internally.
 */
export type ApplicationCommandCapability = {
  operation: string;
  label: string;
  description: string;
  action: ApplicationCommandAction;
};
