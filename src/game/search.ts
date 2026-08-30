import { buildGraphIndex, notationForNode, shortestDistance } from "./graph";
import type { PlayState, ProjectSnapshot } from "./model";
import { normalizeCommand } from "./parser";

export type SearchKind = "node" | "interaction" | "character" | "location" | "item" | "variable" | "computed" | "synth";

export type SearchDocument = {
  id: string;
  kind: SearchKind;
  label: string;
  searchText: string;
  nodeId?: string;
};

export type SearchResult = SearchDocument & {
  score: number;
  notation: string[];
};

export function buildSearchIndex(snapshot: ProjectSnapshot): SearchDocument[] {
  return [
    ...snapshot.nodes.map((node) => {
      const interactions = snapshot.interactions.filter((interaction) => interaction.sourceNodeId === node.id);
      const context = snapshot.entities.filter((entity) =>
        entity.id === node.characterId || entity.id === node.locationId,
      );
      const referencedItemIds = new Set(interactions.flatMap((interaction) =>
        interaction.outcomes.flatMap((outcome) => outcome.effects.flatMap((effect) =>
          effect.type === "give_item" || effect.type === "remove_item" || effect.type === "set_item_state"
            ? [effect.itemId]
            : [],
        )),
      ));
      const referencedItems = snapshot.items.filter((item) => referencedItemIds.has(item.id));
      return {
        id: node.id,
        kind: "node" as const,
        label: `#${String(node.nodeNumber).padStart(3, "0")} ${node.text.slice(0, 90)}`,
        searchText: [
          node.text,
          ...node.tags,
          ...interactions.flatMap((interaction) => [
            interaction.wording,
            interaction.notes,
            ...interaction.aliases,
            ...interaction.tags,
            ...interaction.outcomes.map((outcome) => outcome.responseText),
          ]),
          ...context.flatMap((entity) => [entity.key, entity.name, entity.description, ...entity.tags]),
          ...referencedItems.flatMap((item) => [item.key, item.name, item.description, ...item.tags]),
        ].join(" "),
        nodeId: node.id,
      };
    }),
    ...snapshot.interactions.map((interaction) => ({
      id: interaction.id,
      kind: "interaction" as const,
      label: interaction.wording || interaction.aliases[0] || "untitled interaction",
      searchText: [
        interaction.wording,
        ...interaction.aliases,
        ...interaction.tags,
        ...interaction.outcomes.map((outcome) => outcome.responseText),
      ].join(" "),
      nodeId: interaction.sourceNodeId,
    })),
    ...snapshot.entities.map((entity) => ({
      id: entity.id,
      kind: entity.type,
      label: entity.name,
      searchText: [entity.key, entity.name, entity.description, ...entity.tags].join(" "),
    })),
    ...snapshot.items.map((item) => ({
      id: item.id,
      kind: "item" as const,
      label: item.name,
      searchText: [item.name, item.description, ...item.tags].join(" "),
    })),
    ...snapshot.variables.map((definition) => ({
      id: definition.id,
      kind: "variable" as const,
      label: definition.label,
      searchText: `${definition.key} ${definition.label}`,
    })),
    ...snapshot.computedValues.map((definition) => ({
      id: definition.id,
      kind: "computed" as const,
      label: definition.label,
      searchText: `${definition.key} ${definition.label} ${definition.source}`,
    })),
    ...snapshot.synthSounds.map((sound) => ({
      id: sound.id,
      kind: "synth" as const,
      label: sound.label,
      searchText: `${sound.key} ${sound.label}`,
    })),
  ];
}

function textScore(query: string, document: SearchDocument) {
  const normalized = normalizeCommand(document.searchText);
  if (!query) return 0;
  if (normalized === query) return 1000;
  if (normalized.startsWith(query)) return 700 - Math.min(100, normalized.length - query.length);
  const index = normalized.indexOf(query);
  if (index >= 0) return 500 - Math.min(100, index);
  const queryTokens = query.split(" ").filter(Boolean);
  const matches = queryTokens.filter((token) => normalized.includes(token)).length;
  return matches ? (matches / queryTokens.length) * 300 : 0;
}

export function searchProject(
  snapshot: ProjectSnapshot,
  documents: SearchDocument[],
  state: Pick<PlayState, "currentNodeId" | "traversal">,
  rawQuery: string,
  kinds?: SearchKind[],
  limit = 20,
) {
  const query = normalizeCommand(rawQuery);
  if (!query) return [];
  const graph = buildGraphIndex(snapshot);
  return documents
    .filter((document) => !kinds || kinds.includes(document.kind))
    .map((document): SearchResult => {
      const distance = document.nodeId
        ? shortestDistance(graph, state.currentNodeId, document.nodeId)
        : null;
      const structuralBonus = distance === null ? 0 : Math.max(0, 80 - distance * 8);
      return {
        ...document,
        score: textScore(query, document) + structuralBonus,
        notation: document.nodeId
          ? notationForNode(snapshot, graph, state.currentNodeId, state.traversal, document.nodeId)
          : [],
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}
