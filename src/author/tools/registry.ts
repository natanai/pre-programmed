import type { AuthorToolGroup } from "../AuthorToolIndex";
import { AUTHOR_FEATURES } from "../features/registry";
import type { AuthorToolContext } from "./types";

/**
 * Builds the Author navigation index from the same feature manifests that own
 * focused Author workspace rendering. Group layout is derived from contribution
 * metadata rather than hard-coded in App.tsx.
 */
export function buildAuthorToolGroups(context: AuthorToolContext): AuthorToolGroup[] {
  const contributions = AUTHOR_FEATURES.flatMap((feature) => feature.tools?.(context) ?? []);
  const groups = new Map<string, {
    id: string;
    label: string;
    order: number;
    tools: Array<{ order: number; tool: AuthorToolGroup["tools"][number] }>;
  }>();

  for (const contribution of contributions) {
    const existing = groups.get(contribution.groupId);
    if (existing) {
      existing.order = Math.min(existing.order, contribution.groupOrder);
      existing.tools.push({ order: contribution.toolOrder, tool: contribution.tool });
      continue;
    }
    groups.set(contribution.groupId, {
      id: contribution.groupId,
      label: contribution.groupLabel,
      order: contribution.groupOrder,
      tools: [{ order: contribution.toolOrder, tool: contribution.tool }],
    });
  }

  return [...groups.values()]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((group) => ({
      id: group.id,
      label: group.label,
      tools: group.tools
        .sort((left, right) => left.order - right.order || left.tool.id.localeCompare(right.tool.id))
        .map(({ tool }) => tool),
    }));
}
