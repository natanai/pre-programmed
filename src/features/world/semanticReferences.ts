import type {
  SemanticReferenceCandidate,
  SemanticReferenceContext,
  SemanticReferenceProvider,
} from "../../engine/references/types";
import {
  resolveActiveNodeConversationContext,
  resolveActiveNodeLocationContext,
} from "../narrative/sceneContext";
import type { EntityDefinition } from "./model";
import { WORLD_ENTITY_OPERATION_TARGET_KIND } from "./operationAdapter";
import { characterNameForPresentation } from "./playState";

function uniqueAliases(values: readonly string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function entityCandidate(
  entity: EntityDefinition,
  context: SemanticReferenceContext,
): SemanticReferenceCandidate {
  const presentedName = entity.type === "character"
    ? characterNameForPresentation(entity, context.state, context.authorMode === true)
    : entity.name;
  return {
    id: entity.id,
    key: entity.key || entity.name || entity.id,
    // Discovery and Author ownership always stay canonical even when the Play projection differs.
    label: entity.name || entity.key || entity.id,
    detail: entity.type,
    aliases: uniqueAliases([
      entity.name,
      entity.key,
      ...(entity.aliases ?? []),
      presentedName,
      ...entity.tags,
    ]),
    defaultProjection: "name",
    projections: {
      name: presentedName,
      key: entity.key,
      description: entity.description,
    },
    target: { kind: WORLD_ENTITY_OPERATION_TARGET_KIND, id: entity.id },
    author: { resourceKind: entity.type, resourceId: entity.id },
  };
}

function playerCharacterTargetCandidate(
  entity: EntityDefinition,
  context: SemanticReferenceContext,
): SemanticReferenceCandidate {
  const candidate = entityCandidate(entity, { ...context, authorMode: false });
  const resolvedName = String(candidate.projections.name ?? "");
  return {
    ...candidate,
    aliases: uniqueAliases([resolvedName, ...entity.tags]),
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

const currentConversationCharacterCandidates: SemanticReferenceProvider["candidates"] = (context) => {
  const { snapshot, state } = context;
  const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
  const active = resolveActiveNodeConversationContext(snapshot, state);
  const entity = active
    ? snapshot.entities.find((candidate) => candidate.id === active.characterId && candidate.type === "character")
    : undefined;
  const presentedName = entity
    ? characterNameForPresentation(entity, state, context.authorMode === true)
    : "";
  return [{
    id: "current",
    key: "current-conversation-character",
    label: "Conversation character",
    detail: entity
      ? `Currently with ${entity.name || entity.key}`
      : "No active conversation",
    aliases: ["conversation character", "current character", "current speaker", "speaker"],
    defaultProjection: "name",
    projections: {
      name: presentedName,
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

const availableConversationCharacterTargets: SemanticReferenceProvider["candidates"] = (context) => {
  const active = resolveActiveNodeConversationContext(context.snapshot, context.state);
  if (!active) return [];
  const entity = context.snapshot.entities.find((candidate) =>
    candidate.id === active.characterId && candidate.type === "character");
  if (!entity) return [];
  return [
    playerCharacterTargetCandidate(entity, context),
    ...currentConversationCharacterCandidates({ ...context, authorMode: false }),
  ];
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
      ...context.snapshot.entities.filter((entity) => entity.type === "location").map((entity) => entityCandidate(entity, context)),
    ],
    projectResource: (id, snapshot) => id !== "current" && snapshot.entities.some((entity) => entity.id === id && entity.type === "location")
      ? { resourceKind: "location", resourceId: id }
      : null,
  },
  {
    kind: "world.character",
    label: "Characters",
    description: "Authored people and the Character carried by the active Node conversation.",
    authorSyntax: "character",
    authorContextKeys: ["current-conversation-character", "current-character", "current-speaker"],
    authorResourceKind: "character",
    defaultProjection: "name",
    targetable: true,
    targetAvailabilityDescription: "At play time, Character targets match only the Character currently active in the Node conversation.",
    targetCandidates: availableConversationCharacterTargets,
    candidates: (context) => [
      ...currentConversationCharacterCandidates(context),
      ...context.snapshot.entities.filter((entity) => entity.type === "character").map((entity) => entityCandidate(entity, context)),
    ],
    projectResource: (id, snapshot) => id !== "current" && snapshot.entities.some((entity) => entity.id === id && entity.type === "character")
      ? { resourceKind: "character", resourceId: id }
      : null,
  },
];
