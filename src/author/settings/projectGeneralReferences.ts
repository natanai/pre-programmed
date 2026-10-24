import type { ProjectReferenceContribution } from "../references/types";

/** Terminal templates participate in the same reference/dependency graph as authored narration. */
export const projectTerminalReferences: ProjectReferenceContribution = (snapshot, context) =>
  context.text(snapshot.settings.terminalPrompt).map((reference) => ({
    ...reference,
    ownerKind: "project-terminal",
    ownerId: "terminal",
    ownerLabel: "Terminal prompt",
    route: { type: "feature", feature: "project", workspace: "terminal-settings" },
  }));
