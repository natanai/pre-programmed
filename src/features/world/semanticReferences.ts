import type { SemanticReferenceCandidate, SemanticReferenceProvider } from "../../engine/references/types";
import { resolveActiveNodeLocationContext } from "../narrative/locationContext";
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

const currentLocationCandidates: SemanticReferenceProvider["candidates"] = ({ snapshot, state }) => {
  const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
  const active = resolveActiveNodeLocationContext(snapshot, state);
  const entity = active
    ? snapshot.entities.find((candidate) => candidate.id === active.locationId && candidate.type === "location")
    : undefined;
  return [{
    id: "current",
    key: "current-location",
    label: "Current location",
    detail: entity
      ? `Currently ${entity.name || entity.key}`
      : "No active location",
    aliases: ["here", "current location", "this place"],
    defaultProjection: "name",
    projections: {
      name: entity?.name ?? "",
      key: entity?.key ?? "",
      description: entity?.description ?? "",
    },
    ...(entity ? { target: { kind: WORLD_ENTITY_OPERATION_TARGET_KIND, id: entity.id } } : {}),
    author: entity
      ? { resourceKind: "location", resourceId: entity.id }
      : node ? { resourceKind: "node", resourceId: node.id } : undefined,
    contextual: true,
  }];
};

const currentSpeakerCandidates: SemanticReferenceProvider["candidates"] = ({ snapshot, state }) => {
  const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
  const entity = node?.characterId
    ? snapshot.entities.find((candidate) => candidate.id === node.characterId && candidate.type === "character")
    : undefined;
  return [{
    id: "current",
    key: "current-speaker",
    label: "Current speaker",
    detail: entity
      ? `Currently ${entity.name || entity.key}`
      : "Current node has no character",
    aliases: ["current speaker", "speaker", "this speaker"],
    defaultProjection: "name",
    projections: {
      name: entity?.name ?? "",
      key: entity?.key ?? "",
      description: entity?.description ?? "",
    },
    ...(entity ? { target: { kind: WORLD_ENTITY_OPERATION_TARGET_KIND, id: entity.id } } : {}),
    author: entity
      ? { resourceKind: "character", resourceId: entity.id }
      : node ? { resourceKind: "node", resourceId: node.id } : undefined,
    contextual: true,
  }];
};

export const WORLD_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  {
    kind: "world.location",
    label: "Locations",
    description: "Authored places and the active location carried through narrative traversal.",
    authorSyntax: "location",
    authorContextKeys: ["current-location"],
    authorResourceKind: "location",
    defaultProjection: "name",
    targetable: true,
    candidates: (context) => [
      ...currentLocationCandidates(context),
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
    authorSyntax: "character",
    authorContextKeys: ["current-speaker"],
    authorResourceKind: "character",
    defaultProjection: "name",
    targetable: true,
    candidates: (context) => [
      ...currentSpeakerCandidates(context),
      ...context.snapshot.entities.filter((entity) => entity.type === "character").map(entityCandidate),
    ],
    projectResource: (id, snapshot) => id !== "current" && snapshot.entities.some((entity) => entity.id === id && entity.type === "character")
      ? { resourceKind: "character", resourceId: id }
      : null,
  },
];
