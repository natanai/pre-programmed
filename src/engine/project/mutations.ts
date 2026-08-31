import type { MutationOperation, ProjectSnapshot } from "./model";

function upsertById<T extends { id: string }>(values: T[], next: T) {
  return values.some((value) => value.id === next.id)
    ? values.map((value) => (value.id === next.id ? next : value))
    : [...values, next];
}

/**
 * Deterministically apply authored mutation operations to a project snapshot.
 *
 * This is the shared optimistic/project transformation path. Persistence
 * implementations decide where the mutation is stored; feature modules own the
 * operation payloads; Engine Project owns producing the next snapshot shape.
 */
export function applyOperations(snapshot: ProjectSnapshot, operations: MutationOperation[]) {
  let next = structuredClone(snapshot);
  for (const operation of operations) {
    switch (operation.type) {
      case "node.upsert":
        next.nodes = upsertById(next.nodes, operation.node);
        break;
      case "interaction.upsert":
        next.interactions = upsertById(next.interactions, operation.interaction);
        break;
      case "interaction.delete":
        next.interactions = next.interactions.filter((interaction) => interaction.id !== operation.id);
        break;
      case "entity.upsert":
        next.entities = upsertById(next.entities, operation.entity);
        break;
      case "variable.upsert":
        next.variables = upsertById(next.variables, operation.definition);
        break;
      case "computed.upsert":
        next.computedValues = upsertById(next.computedValues, operation.definition);
        break;
      case "item.upsert":
        next.items = upsertById(next.items, operation.item);
        break;
      case "synth.upsert":
        next.synthSounds = upsertById(next.synthSounds, operation.sound);
        break;
      case "bookmark.upsert":
      case "bookmark.delete":
        // Bookmarks are Author workspace state, not part of ProjectSnapshot.
        break;
    }
  }
  return next;
}
