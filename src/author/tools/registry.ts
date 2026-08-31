import type { AuthorToolGroup } from "../AuthorToolIndex";
import { inventoryAuthorTools } from "../../features/inventory/author/tools";
import { mediaAuthorTools } from "../../features/media/author/tools";
import { narrativeAuthorTools } from "../../features/narrative/author/tools";
import { stateAuthorTools } from "../../features/state/author/tools";
import { projectAuthorTools } from "./projectTools";
import type { AuthorToolContext, AuthorToolContributor } from "./types";

/**
 * Static composition root for Author navigation contributions.
 *
 * A future feature should own its tool definitions next to the feature and add
 * exactly one contributor here. Group layout is derived from contribution
 * metadata rather than hard-coded in App.tsx.
 */
const CONTRIBUTORS: readonly AuthorToolContributor[] = [
  narrativeAuthorTools,
  stateAuthorTools,
  inventoryAuthorTools,
  mediaAuthorTools,
  projectAuthorTools,
];

export function buildAuthorToolGroups(context: AuthorToolContext): AuthorToolGroup[] {
  const contributions = CONTRIBUTORS.flatMap((contributor) => contributor(context));
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
