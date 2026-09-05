import type { SemanticReferenceCandidate, SemanticReferenceProvider } from "../../engine/references/types";
import { WORLD_ENTITY_OPERATION_TARGET_KIND } from "./operationAdapter";
import type { EntityDefinition } from "./model";

function entityCandidate(entity: EntityDefinition): SemanticReferenceCandidate {
  return {
    id: entity.id,
    key: entity.key || entity.name || entity.id,
    label: entity.name || entity.key || entity.id,
    detail: entity.type,
    aliases: [entity.name, entity.key, ...entity.tags].filter(Boolean),
    defaultProjection: "name",
    projections: {
      name: entity.name,
      key: entity.key,
      description: entity.description,
    },
    target: { kind: WORLD_ENTITY_OPERATION_TARGET_KIND, id: entity.id },
    author: { resourceKind: entity.type, resourceId: entity.id },
  };
}

function currentEntityCandidate(
  kind: "location" | "character",
  key: string,
  label: string,
  aliases: string[],
): SemanticReferenceProvider["candidates"] {
  return ({ snapshot, state }) => {
    const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
    const id = kind === "location" ? node?.locationId : node?.characterId;
    const entity = id
      ? snapshot.entities.find((candidate) => candidate.id === id && candidate.type === kind)
      : undefined;
    return [{
      id: "current",
      key,
      label,
      detail: entity
        ? `Currently ${entity.name || entity.key}`
        : `Current node has no ${kind}`,
      aliases,
      defaultProjection: "name",
      projections: {
        name: entity?.name ?? "",
        key: entity?.key ?? "",
        description: entity?.description ?? "",
      },
      ...(entity ? { target: { kind: WORLD_ENTITY_OPERATION_TARGET_KIND, id: entity.id } } : {}),
      // The selector itself has no fake editor. Edit the resolved World resource;
      // if unresolved, edit the Node that owns the relationship.
      author: entity
        ? { resourceKind: kind, resourceId: entity.id }
        : node ? { resourceKind: "node", resourceId: node.id } : undefined,
      contextual: true,
    }];
  };
}

export const WORLD_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  {
    kind: "world.location",
    label: "Locations",
    description: "Authored places and the location belonging to the current Node.",
    authorResourceKind: "location",
    targetable: true,
    candidates: (context) => [
      ...currentEntityCandidate("location", "current-location", "Current location", ["here", "current location", "this place"])(context),
      ...context.snapshot.entities.filter((entity) => entity.type === "location").map(entityCandidate),
    ],
    projectResource: (id, snapshot) => id !== "current" && snapshot.entities.some((entity) => entity.id === id && entity.type === "location")
      ? { resourceKind: "location", resourceId: id }
      : null,
  },
  {
    kind: "world.character",
    label: "Characters",
    description: "Authored people and the speaker assigned to the current Node.",
    authorResourceKind: "character",
    targetable: true,
    candidates: (context) => [
      ...currentEntityCandidate("character", "current-speaker", "Current speaker", ["current speaker", "speaker", "this speaker"])(context),
      ...context.snapshot.entities.filter((entity) => entity.type === "character").map(entityCandidate),
    ],
    projectResource: (id, snapshot) => id !== "current" && snapshot.entities.some((entity) => entity.id === id && entity.type === "character")
      ? { resourceKind: "character", resourceId: id }
      : null,
  },
];
