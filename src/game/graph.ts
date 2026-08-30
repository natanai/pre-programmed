import type { GameNode, ProjectSnapshot } from "./model";

export const GRAPH_NOTATION_DEFINITIONS = [
  { token: "[H]", meaning: "HERE / current node" },
  { token: "[An]", meaning: "n transitions ahead from HERE" },
  { token: "[Pn]", meaning: "n transitions earlier in this traversal" },
  { token: "[Bb/f]", meaning: "back b on this traversal, then forward f on another branch" },
  { token: "[D]", meaning: "unintended dead end here" },
  { token: "[Dn]", meaning: "nearest unintended dead end is n transitions away" },
  { token: "[E]", meaning: "intentional ending" },
  { token: "[L]", meaning: "loop or cycle" },
  { token: "[R]", meaning: "rejoin with another incoming route" },
  { token: "[U]", meaning: "unreachable from project start" },
] as const;

export type GraphIndex = {
  outgoing: Map<string, Set<string>>;
  incoming: Map<string, Set<string>>;
  byId: Map<string, GameNode>;
};

export function buildGraphIndex(snapshot: ProjectSnapshot): GraphIndex {
  const outgoing = new Map(snapshot.nodes.map((node) => [node.id, new Set<string>()]));
  const incoming = new Map(snapshot.nodes.map((node) => [node.id, new Set<string>()]));
  for (const interaction of snapshot.interactions) {
    for (const outcome of interaction.outcomes) {
      if (outcome.disposition !== "transition" || !outcome.destinationNodeId) continue;
      outgoing.get(interaction.sourceNodeId)?.add(outcome.destinationNodeId);
      incoming.get(outcome.destinationNodeId)?.add(interaction.sourceNodeId);
    }
  }
  return { outgoing, incoming, byId: new Map(snapshot.nodes.map((node) => [node.id, node])) };
}

export function shortestDistance(index: GraphIndex, startId: string, targetId: string) {
  if (startId === targetId) return 0;
  const seen = new Set([startId]);
  const queue: Array<[string, number]> = [[startId, 0]];
  while (queue.length) {
    const [id, distance] = queue.shift()!;
    for (const next of index.outgoing.get(id) ?? []) {
      if (next === targetId) return distance + 1;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([next, distance + 1]);
    }
  }
  return null;
}

export function isDeadNode(index: GraphIndex, nodeId: string) {
  const node = index.byId.get(nodeId);
  return Boolean(node && !node.ending && (index.outgoing.get(nodeId)?.size ?? 0) === 0);
}

export function deadEndDistance(index: GraphIndex, startId: string) {
  if (isDeadNode(index, startId)) return 0;
  const seen = new Set([startId]);
  const queue: Array<[string, number]> = [[startId, 0]];
  while (queue.length) {
    const [id, distance] = queue.shift()!;
    for (const next of index.outgoing.get(id) ?? []) {
      if (isDeadNode(index, next)) return distance + 1;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push([next, distance + 1]);
    }
  }
  return null;
}

export function reachableFrom(index: GraphIndex, startId: string) {
  const reached = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    if (reached.has(id)) continue;
    reached.add(id);
    queue.push(...(index.outgoing.get(id) ?? []));
  }
  return reached;
}

export function participatesInCycle(index: GraphIndex, startId: string) {
  const visit = (id: string, path: Set<string>): boolean => {
    for (const next of index.outgoing.get(id) ?? []) {
      if (next === startId) return true;
      if (path.has(next)) continue;
      const nested = new Set(path).add(next);
      if (visit(next, nested)) return true;
    }
    return false;
  };
  return visit(startId, new Set([startId]));
}

export function traversalPreviousDistance(traversal: string[], hereId: string, candidateId: string) {
  const hereIndex = traversal.lastIndexOf(hereId);
  if (hereIndex < 0) return null;
  for (let index = hereIndex - 1; index >= 0; index -= 1) {
    if (traversal[index] === candidateId) return hereIndex - index;
  }
  return null;
}

export function branchRelationship(
  index: GraphIndex,
  traversal: string[],
  hereId: string,
  candidateId: string,
) {
  const hereIndex = traversal.lastIndexOf(hereId);
  if (hereIndex < 0) return null;
  for (let originIndex = hereIndex - 1; originIndex >= 0; originIndex -= 1) {
    const origin = traversal[originIndex];
    const forward = shortestDistance(index, origin, candidateId);
    if (forward === null) continue;
    const back = hereIndex - originIndex;
    if (forward === 0) continue;
    return { back, forward };
  }
  return null;
}

export function notationForNode(
  snapshot: ProjectSnapshot,
  index: GraphIndex,
  hereId: string,
  traversal: string[],
  candidateId: string,
) {
  const tokens: string[] = [];
  const node = index.byId.get(candidateId);
  if (!node) return tokens;

  if (candidateId === hereId) tokens.push("[H]");
  const previous = traversalPreviousDistance(traversal, hereId, candidateId);
  if (previous) tokens.push(`[P${previous}]`);
  const ahead = shortestDistance(index, hereId, candidateId);
  if (ahead && previous === null) tokens.push(`[A${ahead}]`);
  if (ahead === null && previous === null && candidateId !== hereId) {
    const branch = branchRelationship(index, traversal, hereId, candidateId);
    if (branch) tokens.push(`[B${branch.back}/${branch.forward}]`);
  }
  if (node.ending) tokens.push("[E]");
  const deadDistance = deadEndDistance(index, candidateId);
  if (deadDistance === 0) tokens.push("[D]");
  else if (deadDistance !== null) tokens.push(`[D${deadDistance}]`);
  if (participatesInCycle(index, candidateId)) tokens.push("[L]");
  if ((index.incoming.get(candidateId)?.size ?? 0) > 1) tokens.push("[R]");
  if (!reachableFrom(index, snapshot.startNodeId).has(candidateId)) tokens.push("[U]");
  return tokens;
}
