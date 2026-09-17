import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";
import { nodeAuthorTitle } from "../nodeOpenings";
import { nodeConversationCharacterId, nodeConversationMode, nodeLocationMode } from "../sceneContext";

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
      ownerLabel: nodeAuthorTitle(node),
      route: { type: "feature" as const, feature: "narrative", workspace: "node", data: { nodeId: node.id } },
    };
    const conversationCharacterId = nodeConversationCharacterId(node);
    return [
      ...(nodeLocationMode(node) === "set" && node.locationId
        ? [{ ...owner, resourceKind: "location", resourceId: node.locationId, detail: "node location" }]
        : []),
      ...(nodeConversationMode(node) === "set" && conversationCharacterId
        ? [{ ...owner, resourceKind: "character", resourceId: conversationCharacterId, detail: "node conversation character" }]
        : []),
      ...fromTargets(context.effects(node.entryEffects ?? []), owner).map((reference) => ({ ...reference, detail: `node entry · ${reference.detail}` })),
      ...node.openings.flatMap((opening, index) => {
        const openingOwner = {
          ...owner,
          route: {
            ...owner.route,
            data: { nodeId: node.id, openingId: opening.id },
          },
        };
        return [
          ...fromTargets(context.condition(opening.condition), openingOwner).map((reference) => ({ ...reference, detail: `opening ${index + 1} condition · ${reference.detail}` })),
          ...fromTargets(context.text(opening.narrationText), {
            ...openingOwner,
            route: { ...openingOwner.route, data: { ...openingOwner.route.data, section: "narration" } },
          }).map((reference) => ({ ...reference, detail: `opening ${index + 1} narration · ${reference.detail}` })),
          ...fromTargets(context.text(opening.dialogueText), {
            ...openingOwner,
            route: { ...openingOwner.route, data: { ...openingOwner.route.data, section: "dialogue" } },
          }).map((reference) => ({ ...reference, detail: `opening ${index + 1} dialogue · ${reference.detail}` })),
        ];
      }),
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
        ...(outcome.destination ? [{ ...owner, resourceKind: "node", resourceId: outcome.destination.nodeId, detail: `destination for ${outcome.label || "outcome"}${outcome.destination.openingId ? " · specific opening" : " · auto opening"}` }] : []),
        ...(outcome.inputCapture?.destination ? [{
          ...owner,
          resourceKind: "node",
          resourceId: outcome.inputCapture.destination.nodeId,
          detail: `captured-input continuation for ${outcome.label || "outcome"}${outcome.inputCapture.destination.openingId ? " · specific opening" : " · auto opening"}`,
        }] : []),
        ...fromTargets(context.condition(outcome.condition), owner),
        ...fromTargets(context.effects(outcome.effects), owner),
        ...fromTargets(context.effects(outcome.inputCapture?.effects ?? []), owner).map((reference) => ({ ...reference, detail: `captured input · ${reference.detail}` })),
        ...fromTargets(context.text(outcome.responseText), owner),
        ...fromTargets(context.text(outcome.dialogueText ?? ""), owner),
      ]),
    ];
  }),
];
