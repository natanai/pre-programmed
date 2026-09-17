import type { ProjectSnapshot } from "../../src/engine/project/model";
import type { NodeEntryTarget } from "../../src/features/narrative/model";

type IntegrityIssue = {
  key: string;
  message: string;
};

function targetForOutcome(outcome: ProjectSnapshot["interactions"][number]["outcomes"][number]) {
  if (outcome.inputCapture?.disposition === "transition" && outcome.inputCapture.destination) {
    return { target: outcome.inputCapture.destination, section: "input-capture" as const };
  }
  if (outcome.disposition === "transition" && outcome.destination) {
    return { target: outcome.destination, section: "response" as const };
  }
  return null;
}

function validateTarget(
  issues: IntegrityIssue[],
  nodes: Map<string, ProjectSnapshot["nodes"][number]>,
  interactionId: string,
  outcomeId: string,
  target: NodeEntryTarget,
  section: "response" | "input-capture",
) {
  const destination = nodes.get(target.nodeId);
  if (!destination) {
    issues.push({
      key: `interaction:${interactionId}:outcome:${outcomeId}:${section}:destination:${target.nodeId}:missing`,
      message: section === "input-capture"
        ? "A captured-input continuation references a Node that does not exist."
        : "A response destination references a Node that does not exist.",
    });
    return;
  }
  if (target.openingId && !destination.openings.some((opening) => opening.id === target.openingId)) {
    issues.push({
      key: `interaction:${interactionId}:outcome:${outcomeId}:${section}:opening:${target.openingId}:wrong-owner`,
      message: section === "input-capture"
        ? "A captured-input continuation targets an entry response that is not owned by its destination Node. Choose AUTO or an opening from that Node."
        : "A response targets an entry response that is not owned by its destination Node. Choose AUTO or an opening from that Node.",
    });
  }
}

export function narrativeReferenceIssues(snapshot: ProjectSnapshot) {
  const issues: IntegrityIssue[] = [];
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const openingOwners = new Map<string, string>();

  for (const node of snapshot.nodes) {
    if (node.openings.length < 1) {
      issues.push({
        key: `node:${node.id}:openings:none`,
        message: "Every Node needs at least one entry response.",
      });
    }
    for (const opening of node.openings) {
      const previousOwner = openingOwners.get(opening.id);
      if (previousOwner && previousOwner !== node.id) {
        issues.push({
          key: `opening:${opening.id}:duplicate-owner:${node.id}`,
          message: "Node entry response identities must be unique across the project.",
        });
      } else openingOwners.set(opening.id, node.id);
    }
  }

  if (!nodes.has(snapshot.startNodeId)) {
    issues.push({ key: `start-node:${snapshot.startNodeId}:missing`, message: "The project start Node does not exist." });
  }

  for (const interaction of snapshot.interactions) {
    if (!nodes.has(interaction.sourceNodeId)) {
      issues.push({
        key: `interaction:${interaction.id}:source:${interaction.sourceNodeId}:missing`,
        message: "An interaction references a source Node that does not exist.",
      });
    }
    for (const outcome of interaction.outcomes) {
      const target = targetForOutcome(outcome);
      if (!target) continue;
      validateTarget(issues, nodes, interaction.id, outcome.id, target.target, target.section);
    }
  }

  return issues;
}

/** Reject only newly introduced graph/address damage so unrelated historical repairs remain possible. */
export function validateNewNarrativeReferences(before: ProjectSnapshot, after: ProjectSnapshot) {
  const existing = new Set(narrativeReferenceIssues(before).map((issue) => issue.key));
  return narrativeReferenceIssues(after).find((issue) => !existing.has(issue.key))?.message ?? null;
}
