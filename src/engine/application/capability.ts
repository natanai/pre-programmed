export type ApplicationCommandAction = {
  type: "open-player-workspace";
  feature: string;
  workspace: string;
  data?: Record<string, string>;
};

/**
 * A shell-level capability that player command grammar may invoke.
 *
 * Most player wording remains authored project grammar. `systemPatterns` is
 * reserved for installation-independent application commands such as portable
 * save/load that must exist even in projects created before the capability was
 * installed.
 */
export type ApplicationCommandCapability = {
  operation: string;
  label: string;
  description: string;
  systemPatterns?: readonly string[];
  action: ApplicationCommandAction;
};
