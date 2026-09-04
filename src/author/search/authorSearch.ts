import { AUTHOR_FEATURES } from "../features/registry";
import type { AuthorToolGroup } from "../AuthorToolIndex";
import type { AuthorSearchContext, AuthorSearchEntry } from "./types";
import { buildSearchIndex } from "./projectSearch";

export function buildAuthorSearchEntries(
  context: AuthorSearchContext,
  toolGroups: AuthorToolGroup[],
) {
  const entries: AuthorSearchEntry[] = [];
  const projectDocuments = buildSearchIndex(context.snapshot);

  for (const group of toolGroups) {
    for (const tool of group.tools) entries.push({
      id: `tool:${group.id}:${tool.id}`,
      groupLabel: group.label,
      label: tool.label,
      description: tool.description,
      searchText: tool.searchText,
      onSelect: tool.onSelect,
    });
  }

  for (const feature of AUTHOR_FEATURES) {
    for (const entry of feature.search?.(context) ?? []) entries.push(entry);

    for (const section of feature.projectSettings ?? []) {
      entries.push({
        id: `setting:${feature.id}:${section.id}`,
        groupLabel: "PROJECT SETTINGS",
        label: section.label,
        description: section.description,
        searchText: `advanced settings project configuration ${section.id}`,
        onSelect: () => context.pushTask({
          type: "feature",
          feature: "project",
          workspace: "settings",
          data: { section: section.id },
        }),
      });
    }

    for (const provider of feature.resources ?? []) {
      if (provider.searchable === false) continue;
      if (provider.createRoute) entries.push({
        id: `resource-create:${feature.id}:${provider.kind}`,
        groupLabel: "CREATE",
        label: `NEW ${provider.label}`,
        description: `Create a new ${provider.label.toLocaleLowerCase()}.`,
        searchText: `${provider.kind} ${provider.pluralLabel ?? ""} add make author`,
        onSelect: () => {
          const route = provider.createRoute?.();
          if (route) context.pushTask(route);
        },
      });
      for (const resource of provider.list(context.snapshot)) {
        const route = provider.editRoute?.(resource, context.snapshot);
        if (!route) continue;
        const projectDocument = projectDocuments.find((document) => document.id === resource.id);
        entries.push({
          id: `resource:${feature.id}:${provider.kind}:${resource.id}`,
          groupLabel: provider.pluralLabel?.toLocaleUpperCase() ?? `${provider.label.toLocaleUpperCase()}S`,
          label: resource.label,
          description: resource.detail || `Edit ${provider.label.toLocaleLowerCase()}.`,
          searchText: `${provider.kind} ${provider.label} ${provider.pluralLabel ?? ""} ${resource.value} ${projectDocument?.searchText ?? ""}`,
          onSelect: () => context.pushTask(route),
        });
      }
    }
  }

  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}
