import type { ProjectSnapshot } from "../../src/engine/project/model";

type IntegrityIssue = {
  key: string;
  message: string;
};

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
      if (outcome.disposition !== "transition" || !outcome.destination) continue;
      const destination = nodes.get(outcome.destination.nodeId);
      if (!destination) {
        issues.push({
          key: `interaction:${interaction.id}:outcome:${outcome.id}:destination:${outcome.destination.nodeId}:missing`,
          message: "A response destination references a Node that does not exist.",
        });
        continue;
      }
      if (outcome.destination.openingId
        && !destination.openings.some((opening) => opening.id === outcome.destination?.openingId)) {
        issues.push({
          key: `interaction:${interaction.id}:outcome:${outcome.id}:opening:${outcome.destination.openingId}:wrong-owner`,
          message: "A response targets an entry response that is not owned by its destination Node. Choose AUTO or an opening from that Node.",
        });
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
