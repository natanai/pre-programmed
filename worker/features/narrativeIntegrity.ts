import type { ProjectSnapshot } from "../../src/engine/project/model";
import { flowDestinations } from "../../src/features/narrative/flow";
import type { NodeEntryTarget } from "../../src/features/narrative/model";

type IntegrityIssue = {
  key: string;
  message: string;
};

function validateTarget(
  issues: IntegrityIssue[],
  nodes: Map<string, ProjectSnapshot["nodes"][number]>,
  ownerKey: string,
  target: NodeEntryTarget,
  ownerLabel: "response" | "node-opening",
) {
  const destination = nodes.get(target.nodeId);
  if (!destination) {
    issues.push({
      key: `${ownerKey}:destination:${target.nodeId}:missing`,
      message: ownerLabel === "response"
        ? "A response destination references a Node that does not exist."
        : "A Node entry continuation references a Node that does not exist.",
    });
    return;
  }
  if (target.openingId && !destination.openings.some((opening) => opening.id === target.openingId)) {
    issues.push({
      key: `${ownerKey}:opening:${target.openingId}:wrong-owner`,
      message: ownerLabel === "response"
        ? "A response targets an entry response that is not owned by its destination Node. Choose AUTO or an opening from that Node."
        : "A Node entry continuation targets an entry response that is not owned by its destination Node. Choose AUTO or an opening from that Node.",
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

      for (const [index, target] of flowDestinations(opening.after).entries()) {
        validateTarget(
          issues,
          nodes,
          `node:${node.id}:opening:${opening.id}:flow:${index}`,
          target,
          "node-opening",
        );
      }
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
      for (const [index, target] of flowDestinations(outcome.after).entries()) {
        validateTarget(
          issues,
          nodes,
          `interaction:${interaction.id}:outcome:${outcome.id}:flow:${index}`,
          target,
          "response",
        );
      }
    }
  }

  return issues;
}

/** Reject only newly introduced graph/address damage so unrelated historical repairs remain possible. */
export function validateNewNarrativeReferences(before: ProjectSnapshot, after: ProjectSnapshot) {
  const existing = new Set(narrativeReferenceIssues(before).map((issue) => issue.key));
  return narrativeReferenceIssues(after).find((issue) => !existing.has(issue.key))?.message ?? null;
}
