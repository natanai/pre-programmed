import { describe, expect, it } from "vitest";
import {
  persistAuthorMutation,
  type AuthorLocalPersistence,
} from "../src/author/persistence/authorProjectPersistence";
import { applyOperations } from "../src/game/mutations";
import type { MutationOperation, ProjectMutation, ProjectSnapshot } from "../src/game/model";
import {
  ProjectWriteRejectedError,
  type ProjectPersistence,
} from "../src/platform/persistence/projectPersistence";
import type { QueuedMutation } from "../src/data/localProject";
import { node, project } from "./fixtures";

function mutation(description: string, expectedRevision: number, operations: MutationOperation[]): ProjectMutation {
  return { description, expectedRevision, operations };
}

function localStore(initial: QueuedMutation[] = []) {
  let queued = structuredClone(initial);
  const cached: ProjectSnapshot[] = [];
  let nextId = 1;
  const local: AuthorLocalPersistence = {
    async saveCachedSnapshot(snapshot) {
      cached.push(structuredClone(snapshot));
      return true;
    },
    async queueMutation(value) {
      const id = `queued-${nextId++}`;
      queued.push({ id, mutation: structuredClone(value), queuedAt: new Date(nextId * 1_000).toISOString() });
      return { id, stored: true };
    },
    async removeQueuedMutation(id) {
      queued = queued.filter((entry) => entry.id !== id);
    },
    async listQueuedMutations() {
      return structuredClone(queued);
    },
  };
  return { local, queued: () => queued, cached };
}

function memoryPersistence(initial: ProjectSnapshot) {
  let server = structuredClone(initial);
  const writes: ProjectMutation[] = [];
  const persistence: ProjectPersistence = {
    async readProject() {
      return structuredClone(server);
    },
    async writeProject(value) {
      writes.push(structuredClone(value));
      if (value.expectedRevision !== server.revision) throw new Error("unexpected test revision");
      server = { ...applyOperations(server, value.operations), revision: server.revision + 1 };
      return structuredClone(server);
    },
  };
  return { persistence, writes, snapshot: () => server };
}

describe("Author project persistence", () => {
  it("publishes queued dependencies before a later edit that references their state", async () => {
    const hosted = project({ revision: 10 });
    const earlier = mutation("Created dependency", 10, [{ type: "node.upsert", node: node("b", 2) }]);
    const localSnapshot = applyOperations(hosted, earlier.operations);
    const current = mutation("Saved dependent edit", 10, [{ type: "node.upsert", node: node("c", 3) }]);
    const optimistic = applyOperations(localSnapshot, current.operations);
    const queue = localStore([{ id: "earlier", mutation: earlier, queuedAt: new Date(1_000).toISOString() }]);
    const remote = memoryPersistence(hosted);

    const result = await persistAuthorMutation({
      persistence: remote.persistence,
      authorization: "token",
      mutation: current,
      optimisticSnapshot: optimistic,
      previousSnapshot: localSnapshot,
      local: queue.local,
    });

    expect(result.status).toBe("saved");
    expect(remote.writes.map((entry) => [entry.description, entry.expectedRevision])).toEqual([
      ["Created dependency", 10],
      ["Saved dependent edit", 11],
    ]);
    expect(remote.snapshot().nodes.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(queue.queued()).toEqual([]);
  });

  it("keeps a transiently unavailable write in this browser's durable queue", async () => {
    const before = project({ revision: 4 });
    const operation = { type: "node.upsert" as const, node: node("b", 2) };
    const optimistic = applyOperations(before, [operation]);
    const queue = localStore();
    const persistence: ProjectPersistence = {
      async readProject() { return before; },
      async writeProject() { throw new TypeError("offline"); },
    };

    const result = await persistAuthorMutation({
      persistence,
      authorization: "token",
      mutation: mutation("Offline edit", 4, [operation]),
      optimisticSnapshot: optimistic,
      previousSnapshot: before,
      local: queue.local,
    });

    expect(result.status).toBe("queued");
    expect(queue.queued()).toHaveLength(1);
    expect(queue.cached.at(-1)?.nodes.some((entry) => entry.id === "b")).toBe(true);
  });

  it("does not disguise a rejected payload as an offline save", async () => {
    const before = project({ revision: 7 });
    const operation = { type: "node.upsert" as const, node: node("b", 2) };
    const queue = localStore();
    const persistence: ProjectPersistence = {
      async readProject() { return before; },
      async writeProject() { throw new ProjectWriteRejectedError("Referenced item is missing."); },
    };

    const result = await persistAuthorMutation({
      persistence,
      authorization: "token",
      mutation: mutation("Invalid edit", 7, [operation]),
      optimisticSnapshot: applyOperations(before, [operation]),
      previousSnapshot: before,
      local: queue.local,
    });

    expect(result).toMatchObject({ status: "failed", message: "Referenced item is missing." });
    expect(queue.queued()).toEqual([]);
    expect(queue.cached.at(-1)).toEqual(before);
  });
});
