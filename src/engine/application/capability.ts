export type ApplicationCommandAction = {
  type: "open-player-workspace";
  feature: string;
  workspace: string;
  data?: Record<string, string>;
};

/**
 * A shell-level capability that authored player command grammar may invoke.
 *
 * Capabilities supply stable engine behavior only. Player-facing wording lives
 * entirely in editable project command data so authors can rename, disable, or
 * remove every terminal phrase without hidden parser exceptions.
 */
export type ApplicationCommandCapability = {
  operation: string;
  label: string;
  description: string;
  action: ApplicationCommandAction;
};
