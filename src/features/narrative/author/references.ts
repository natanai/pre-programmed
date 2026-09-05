import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";
import { nodeConversation, nodeLocationMode, nodePresentCharacters } from "../sceneContext";

function fromTargets(
  targets: readonly ResourceReference[],
  owner: Omit<ReturnType<ProjectReferenceContribution>[number], "resourceKind" | "resourceId" | "detail">,
) {
  return targets.map((target) => ({ ...owner, ...target }));
}

export const narrativeProjectReferences: ProjectReferenceContribution = (snapshot, context) => [
  ...snapshot.nodes.flatMap((node) => {
    const owner = {
      ownerKind: "node",
      ownerId: node.id,
      ownerLabel: `Node #${node.nodeNumber}`,
      route: { type: "feature" as const, feature: "narrative", workspace: "node", data: { nodeId: node.id } },
    };
    const presentCharacters = nodePresentCharacters(node);
    const conversation = nodeConversation(node);
    return [
      ...(node.characterId ? [{ ...owner, resourceKind: "character", resourceId: node.characterId, detail: "node speaker" }] : []),
      ...(nodeLocationMode(node) === "set" && node.locationId
        ? [{ ...owner, resourceKind: "location", resourceId: node.locationId, detail: "node location" }]
        : []),
      ...(presentCharacters.mode === "set"
        ? presentCharacters.characterIds.map((characterId) => ({ ...owner, resourceKind: "character" as const, resourceId: characterId, detail: "character present in node scene" }))
        : []),
      ...(conversation.mode === "set"
        ? conversation.characterIds.map((characterId) => ({ ...owner, resourceKind: "character" as const, resourceId: characterId, detail: "node conversation participant" }))
        : []),
      ...fromTargets(context.text(node.text), owner),
    ];
  }),
  ...snapshot.interactions.flatMap((interaction) => {
    const label = interaction.wording || interaction.aliases[0] || "Invalid input response";
    const owner = {
      ownerKind: "interaction",
      ownerId: interaction.id,
      ownerLabel: label,
      route: { type: "feature" as const, feature: "narrative", workspace: "interaction", data: { interactionId: interaction.id } },
    };
    return [
      { ...owner, resourceKind: "node", resourceId: interaction.sourceNodeId, detail: "source node" },
      ...(interaction.choiceVisibleWhen
        ? fromTargets(context.condition(interaction.choiceVisibleWhen), owner).map((reference) => ({ ...reference, detail: `choice visibility · ${reference.detail}` }))
        : []),
      ...interaction.outcomes.flatMap((outcome) => [
        ...(outcome.speakerId ? [{ ...owner, resourceKind: "character", resourceId: outcome.speakerId, detail: `speaker for ${outcome.label || "outcome"}` }] : []),
        ...(outcome.destinationNodeId ? [{ ...owner, resourceKind: "node", resourceId: outcome.destinationNodeId, detail: `destination for ${outcome.label || "outcome"}` }] : []),
        ...fromTargets(context.condition(outcome.condition), owner),
        ...fromTargets(context.effects(outcome.effects), owner),
        ...fromTargets(context.text(outcome.responseText), owner),
      ]),
    ];
  }),
];