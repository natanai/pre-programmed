import type { SemanticReferenceProvider } from "../../engine/references/types";

function keyFromLabel(label: string, fallback: string) {
  const key = label
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key || fallback;
}

export const COMMAND_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [{
  kind: "commands.player-command",
  label: "Player commands",
  description: "Authored project-wide player command definitions.",
  authorSyntax: "player-command",
  authorResourceKind: "player-command",
  defaultProjection: "label",
  candidates: ({ snapshot }) => snapshot.settings.commands.commands.map((command) => ({
    id: command.id,
    key: keyFromLabel(command.label, `command-${command.id.slice(0, 8)}`),
    label: command.label || "Untitled player command",
    detail: command.patterns.join(" · ") || "No player wording",
    aliases: [command.label, ...command.patterns].filter(Boolean),
    defaultProjection: "label",
    projections: {
      label: command.label,
      input: command.patterns[0] ?? "",
    },
    author: { resourceKind: "player-command", resourceId: command.id },
  })),
  projectResource: (id, snapshot) => snapshot.settings.commands.commands.some((command) => command.id === id)
    ? { resourceKind: "player-command", resourceId: id }
    : null,
}];
