import type { MutationOperation, PlayState, ProjectSnapshot } from "../../game/model";
import type { AuthorTaskData, AuthorTaskRoute, AuthorTaskValue } from "../tasks/types";

export type AuthorCapabilityRequest = {
  capability: string;
  data?: AuthorTaskData;
};

export type AuthorCapabilityContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
};

export type AuthorCapabilityResolution =
  | { type: "task"; route: AuthorTaskRoute }
  | { type: "mutation"; operations: MutationOperation[]; description: string; message?: string }
  | { type: "handled"; message?: string; value?: AuthorTaskValue };

/** A semantic Author capability owned by one feature. */
export type AuthorCapability = {
  id: string;
  resolve: (
    request: AuthorCapabilityRequest,
    context: AuthorCapabilityContext,
  ) => AuthorCapabilityResolution | null;
};
