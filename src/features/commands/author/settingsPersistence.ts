import type { AuthorWorkspaceContext } from "../../../author/features/types";
import type { CommandProjectSettings, ReferenceSourceSetting } from "../model";

export function referenceSetting(commands: CommandProjectSettings, sourceKind: string): ReferenceSourceSetting {
  return structuredClone(commands.referenceSources.find((setting) => setting.sourceKind === sourceKind) ?? {
    sourceKind,
    enabled: false,
    includeDefaults: true,
    aliases: {},
  });
}

export function updateReferenceSetting(
  commands: CommandProjectSettings,
  setting: ReferenceSourceSetting,
): CommandProjectSettings {
  return {
    ...commands,
    referenceSources: commands.referenceSources.some((candidate) => candidate.sourceKind === setting.sourceKind)
      ? commands.referenceSources.map((candidate) => candidate.sourceKind === setting.sourceKind ? setting : candidate)
      : [...commands.referenceSources, setting],
  };
}

export async function persistCommands(
  context: AuthorWorkspaceContext,
  commands: CommandProjectSettings,
  description: string,
) {
  return context.persist([{
    type: "project.settings",
    settings: { ...context.snapshot.settings, commands },
  }], description);
}
