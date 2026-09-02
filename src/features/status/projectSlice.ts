import type { StatusEntryDefinition, StatusGroupDefinition } from "./model";

export type StatusProjectSlice = {
  statusGroups: StatusGroupDefinition[];
  statusEntries: StatusEntryDefinition[];
};
