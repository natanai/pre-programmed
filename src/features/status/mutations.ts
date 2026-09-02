import type { StatusEntryDefinition, StatusGroupDefinition } from "./model";

export type StatusMutationOperation =
  | { type: "statusGroup.upsert"; group: StatusGroupDefinition }
  | { type: "statusEntry.upsert"; entry: StatusEntryDefinition };
