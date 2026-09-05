import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import { buildGraphIndex, notationForNode, shortestDistance } from "../../features/narrative/graph";
import { normalizeCommand } from "../../features/narrative/parser";
import { getAuthorSearchDocumentContributions } from "../features/registry";
import type { SearchDocument, SearchKind } from "./types";

export type { SearchDocument, SearchKind } from "./types";

export type SearchResult = SearchDocument & {
  score: number;
  notation: string[];
};

/** Cross-feature Author search index; optional feature documents enter through contributions. */
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
            ...interaction.outcomes.flatMap((outcome) => [
              outcome.label,
              outcome.responseText,
              JSON.stringify(outcome.condition),
              JSON.stringify(outcome.effects),
              outcome.speakerId ?? "",
            ]),
          ]),
          JSON.stringify(node.performance.cues),
          ...context.flatMap((entity) => [entity.key, entity.name, entity.description, ...entity.tags]),
          ...referencedItems.flatMap((item) => [item.key, item.name, item.description, ...item.tags]),
        ].join(" "),
        nodeId: node.id,
      };
    }),
    ...snapshot.interactions.map((interaction) => ({
      id: interaction.id,
      kind: "interaction" as const,
      label: interaction.matchMode === "fallback"
        ? "INVALID INPUT"
        : interaction.wording || interaction.aliases[0] || "untitled interaction",
      searchText: [
        interaction.wording,
        ...interaction.aliases,
        ...interaction.tags,
        interaction.notes,
        ...interaction.outcomes.flatMap((outcome) => [
          outcome.label,
          outcome.responseText,
          JSON.stringify(outcome.condition),
          JSON.stringify(outcome.effects),
          outcome.speakerId ?? "",
        ]),
      ].join(" "),
      nodeId: interaction.sourceNodeId,
    })),
    ...snapshot.entities.map((entity) => ({
      id: entity.id,
      kind: entity.type,
      label: entity.name,
      searchText: [entity.key, entity.name, entity.description, ...entity.tags, ...(entity.operations ?? []), JSON.stringify(entity.hooks ?? [])].join(" "),
    })),
    ...snapshot.items.map((item) => ({
      id: item.id,
      kind: "item" as const,
      label: item.name,
      searchText: [
        item.key,
        item.name,
        item.description,
        ...item.tags,
        ...(item.operations ?? []),
        JSON.stringify(item.hooks ?? []),
        ...(item.equipmentPlacements ?? []).flatMap((placement) => [placement.anchorSlotKey, ...placement.occupiedSlotKeys]),
        item.equippedStorage ?? "inventory",
        item.equipOnGiveSlotKey ?? "",
      ].join(" "),
    })),
    ...snapshot.variables.map((definition) => ({
      id: definition.id,
      kind: "variable" as const,
      label: definition.label,
      searchText: `${definition.key} ${definition.label} ${definition.valueType} ${definition.timeRate ?? 0} ${definition.timeUnit ?? ""} ${(definition.operations ?? []).join(" ")} ${JSON.stringify(definition.hooks ?? [])}`,
    })),
    ...snapshot.computedValues.map((definition) => ({
      id: definition.id,
      kind: "computed" as const,
      label: definition.label,
      searchText: `${definition.key} ${definition.label} ${definition.source} ${(definition.operations ?? []).join(" ")} ${JSON.stringify(definition.hooks ?? [])}`,
    })),
    ...(snapshot.bodyBackgrounds ?? []).map((bodyType) => ({
      id: bodyType.id,
      kind: "body-type" as const,
      label: bodyType.name,
      searchText: `${bodyType.name} ${bodyType.assetId} ${(bodyType.slots ?? []).flatMap((slot) => [slot.name, slot.key]).join(" ")} ${(bodyType.startingEquipment ?? []).flatMap((assignment) => [assignment.slotKey, assignment.itemId]).join(" ")} ${snapshot.startingBodyBackgroundId === bodyType.id ? "starting default active body" : ""}`,
    })),
    ...snapshot.settings.commands.commands.map((command) => {
      const actionText = command.action.type === "response"
        ? `respond response ${command.action.responseText}`
        : command.action.type === "application"
          ? `application ${command.action.operation}`
          : `target operation ${command.action.operation} ${command.action.targetSlot}`;
      return {
        id: command.id,
        kind: "command" as const,
        label: command.label || "Untitled command",
        searchText: `${command.label} ${actionText} ${command.patterns.join(" ")} ${command.slots.flatMap((slot) => [slot.name, ...slot.sourceKinds]).join(" ")}`,
      };
    }),
    ...getAuthorSearchDocumentContributions().flatMap((contribution) => contribution(snapshot)),
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
      const lexicalScore = textScore(query, document);
      const distance = document.nodeId
        ? shortestDistance(graph, state.currentNodeId, document.nodeId)
        : null;
      const structuralBonus = lexicalScore > 0 && distance !== null
        ? Math.max(0, 80 - distance * 8)
        : 0;
      return {
        ...document,
        score: lexicalScore > 0 ? lexicalScore + structuralBonus : 0,
        notation: document.nodeId
          ? notationForNode(snapshot, graph, state.currentNodeId, state.traversal, document.nodeId)
          : [],
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}
