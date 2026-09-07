import type { AuthorProjectSettingsSection } from "../features/types";
import { defineAuthorWorkspace } from "../ui/workspaceDefinition";

export function createProjectSettingsWorkspace(sections: readonly AuthorProjectSettingsSection[]) {
  const ordered = [...sections].sort(
    (left, right) => (left.order ?? 100) - (right.order ?? 100) || left.label.localeCompare(right.label),
  );

  return defineAuthorWorkspace<null>({
    id: "project-settings-index",
    matches: (route) => route.type === "feature" && route.feature === "project" && route.workspace === "settings",
    createDraft: () => null,
    buildSpec: ({ context }) => ({
      id: "project-settings-index",
      title: "ADVANCED PROJECT SETTINGS",
      context: `${ordered.length} ${ordered.length === 1 ? "section" : "sections"}`,
      blocks: ordered.length
        ? ordered.map((section) => ({
          type: "section" as const,
          id: `project-settings:${section.id}`,
          label: section.label,
          summary: section.description,
          children: [{
            type: "action-row" as const,
            id: `project-settings-open:${section.id}`,
            actions: [{
              id: `project-settings-open-action:${section.id}`,
              label: "OPEN",
              onAction: () => context.pushTask(section.route),
            }],
          }],
        }))
        : [{
          type: "status" as const,
          id: "project-settings-empty",
          text: "NO ADVANCED PROJECT SETTINGS ARE CONTRIBUTED.",
        }],
    }),
  });
}
