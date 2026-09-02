import { normalizePlayerInput } from "../../engine/input/normalize";
import type { AuthorToolGroup } from "../AuthorToolIndex";
import { AUTHOR_FEATURES } from "../features/registry";
import type { AuthorToolContext } from "../tools/types";
import type { AuthorSearchEntry } from "./types";
import { buildSearchIndex } from "./projectSearch";

function searchableText(entry: AuthorSearchEntry) {
  return normalizePlayerInput(`${entry.groupLabel} ${entry.label} ${entry.description} ${entry.searchText}`);
}

function scoreEntry(entry: AuthorSearchEntry, query: string) {
  const label = normalizePlayerInput(entry.label);
  const text = searchableText(entry);
  const tokens = query.split(" ").filter(Boolean);
  if (!tokens.every((token) => text.includes(token))) return 0;
  if (label === query) return 1000;
  if (label.startsWith(query)) return 800;
  if (label.includes(query)) return 650;
  if (text.includes(query)) return 500;
  return 300 + tokens.length;
}

export function searchAuthorEntries(entries: readonly AuthorSearchEntry[], rawQuery: string, limit = 40) {
  const query = normalizePlayerInput(rawQuery);
  if (!query) return [];
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.label.localeCompare(right.entry.label))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

/**
 * Compose Author search from installed feature destinations, project settings,
 * and resource providers. Features own their vocabulary; the shell only
 * transports and ranks entries.
 */
export function buildAuthorSearchEntries(
  context: AuthorToolContext,
  groups: readonly AuthorToolGroup[],
): AuthorSearchEntry[] {
  const projectDocuments = buildSearchIndex(context.snapshot);
  const entries: AuthorSearchEntry[] = groups.flatMap((group) => group.tools.map((tool) => ({
    id: `tool:${group.id}:${tool.id}`,
    groupLabel: group.label,
    label: tool.label,
    description: tool.description,
    searchText: tool.searchText ?? "",
    tone: tool.tone,
    onSelect: tool.onSelect,
  })));

  for (const feature of AUTHOR_FEATURES) {
    entries.push(...(feature.search?.(context) ?? []));

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
        const route = provider.editRoute?.(resource);
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
