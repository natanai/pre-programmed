import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../features/types";
import { defineAuthorWorkspace } from "../ui/workspaceDefinition";

export function createProjectSettingsWorkspace(sections: readonly AuthorProjectSettingsSection[]) {
  const ordered = [...sections].sort(
    (left, right) => (left.order ?? 100) - (right.order ?? 100) || left.label.localeCompare(right.label),
  );

  const defaults = ordered.filter((section) => section.group === "defaults");
  const other = ordered.filter((section) => section.group !== "defaults");
  const openSection = (section: AuthorProjectSettingsSection, context: AuthorWorkspaceContext) => ({
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
  });
  return defineAuthorWorkspace<null>({
    id: "project-settings-index",
    matches: (route) => route.type === "feature" && route.feature === "project" && route.workspace === "settings",
    createDraft: () => null,
    buildSpec: ({ context }) => ({
      id: "project-settings-index",
      title: "ADVANCED PROJECT SETTINGS",
      context: `${ordered.length} ${ordered.length === 1 ? "section" : "sections"}`,
      blocks: ordered.length
        ? [
          ...(defaults.length ? [{
            type: "section" as const,
            id: "project-settings-defaults",
            label: "DEFAULTS",
            children: defaults.map((section) => openSection(section, context)),
          }] : []),
          ...other.map((section) => openSection(section, context)),
        ]
        : [{
          type: "status" as const,
          id: "project-settings-empty",
          text: "NO ADVANCED PROJECT SETTINGS ARE CONTRIBUTED.",
        }],
    }),
  });
}
