import type { ProjectSnapshot } from "../../engine/project/model";

export function nextNodeNumber(snapshot: ProjectSnapshot) {
  return snapshot.nodes.reduce((maximum, node) => Math.max(maximum, node.nodeNumber), 0) + 1;
}
