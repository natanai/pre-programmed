export type ApplicationCommandAction = {
  type: "open-player-workspace";
  feature: string;
  workspace: string;
  data?: Record<string, string>;
};

/**
 * A shell-level capability that authored targetless command grammar may invoke.
 *
 * The operation ID is stable module vocabulary; player-facing words remain
 * project grammar. Player workspace actions are deliberately distinct from
 * Author task routes so a normal player command can never enter Author mode.
 */
export type ApplicationCommandCapability = {
  operation: string;
  label: string;
  description: string;
  action: ApplicationCommandAction;
};
