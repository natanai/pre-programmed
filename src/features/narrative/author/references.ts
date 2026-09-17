import type { ProjectReferenceContribution, ResourceReference } from "../../../author/references/types";
import type { NarrativeFlowStep } from "../model";
import { nodeAuthorTitle } from "../nodeOpenings";
import { nodeConversationCharacterId, nodeConversationMode, nodeLocationMode } from "../sceneContext";

function fromTargets(
  targets: readonly ResourceReference[],
  owner: Omit<ReturnType<ProjectReferenceContribution>[number], "resourceKind" | "resourceId" | "detail">,
) {
  return targets.map((target) => ({ ...owner, ...target }));
}

function flowReferences(
  flow: readonly NarrativeFlowStep[],
  owner: Omit<ReturnType<ProjectReferenceContribution>[number], "resourceKind" | "resourceId" | "detail">,
  context: Parameters<ProjectReferenceContribution>[1],
  detailPrefix: string,
): ReturnType<ProjectReferenceContribution> {
  return flow.flatMap((step, index) => {
    const prefix = `${detailPrefix} · step ${index + 1}`;
    if (step.type === "transition") return [{
      ...owner,
      resourceKind: "node",
      resourceId: step.destination.nodeId,
      detail: `${prefix} · destination${step.destination.openingId ? " · specific opening" : " · auto opening"}`,
    }];
    if (step.type === "effects") {
      return fromTargets(context.effects(step.effects), owner).map((reference) => ({
        ...reference,
        detail: `${prefix} · ${reference.detail}`,
      }));
    }
    if (step.type === "present") {
      return [
        ...(step.speakerId ? [{
          ...owner,
          resourceKind: "character",
          resourceId: step.speakerId,
          detail: `${prefix} · speaker`,
        }] : []),
        ...fromTargets(context.text(step.responseText), owner).map((reference) => ({
          ...reference,
          detail: `${prefix} · narration · ${reference.detail}`,
        })),
        ...fromTargets(context.text(step.dialogueText), owner).map((reference) => ({
          ...reference,
          detail: `${prefix} · dialogue · ${reference.detail}`,
        })),
      ];
    }
    return [];
  });
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
          ...flowReferences(opening.after, openingOwner, context, `opening ${index + 1} after`),
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
        ...fromTargets(context.condition(outcome.condition), owner),
        ...fromTargets(context.effects(outcome.effects), owner),
        ...fromTargets(context.text(outcome.responseText), owner),
        ...fromTargets(context.text(outcome.dialogueText ?? ""), owner),
        ...flowReferences(outcome.after, owner, context, `after ${outcome.label || "outcome"}`),
      ]),
    ];
  }),
];
