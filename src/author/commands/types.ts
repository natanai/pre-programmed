import type { ProjectSnapshot } from "../../engine/project/model";
import type { AuthorTaskRoute } from "../tasks/types";

export type AuthorCommandTargetOption = {
  id: string;
  label: string;
  detail?: string;
  available: boolean;
  responseCount: number;
};

/**
 * Feature-owned bridge from player-command target kinds to their authoring UI.
 * Commands can route to any installed target domain without importing it or
 * maintaining a central resource-kind switch.
 */
export type AuthorCommandTargetAdapter = {
  sourceKind: string;
  label: string;
  list: (snapshot: ProjectSnapshot, operation: string) => readonly AuthorCommandTargetOption[];
  editRoute: (id: string, operation: string) => AuthorTaskRoute;
  createRoute?: (operation: string) => AuthorTaskRoute;
};
