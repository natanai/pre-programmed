export type AuthorTaskValue =
  | null
  | boolean
  | number
  | string
  | AuthorTaskValue[]
  | { [key: string]: AuthorTaskValue };

export type AuthorTaskData = Record<string, AuthorTaskValue>;

export type AuthorTaskRoute =
  | { type: "tools" }
  | { type: "workspace"; view?: "navigation" | "history" }
  | { type: "feature"; feature: string; workspace: string; data?: Record<string, string> };

export type AuthorResourceResult = {
  type: "resource";
  kind: string;
  id: string;
  value: string;
  label: string;
};

/** Confirmed owner-task deletion of one canonical Author resource. */
export type AuthorResourceDeletedResult = {
  type: "resource-deleted";
  kind: string;
  /** Stable owner resource id. */
  id: string;
  /** Reference value exposed by the resource provider before deletion. */
  value: string;
};

/**
 * Open result envelope for recursively composed Author work.
 *
 * Core transports the result without knowing its meaning. The capability that
 * opened the task owns the payload contract and validates it before use.
 */
export type AuthorCapabilityResult = {
  type: "capability";
  capability: string;
  owner: string;
  value?: AuthorTaskValue;
};

export type AuthorTaskResult = AuthorResourceResult | AuthorResourceDeletedResult | AuthorCapabilityResult | { type: "saved" };

export type AuthorTaskEntry = {
  id: string;
  route: AuthorTaskRoute;
  dirty: boolean;
};

export type AuthorLeaveConfirmation = {
  action: "back" | "close";
  dirtyCount: number;
  taskId?: string;
};

export type AuthorTaskCompletion = (result?: AuthorTaskResult) => void;
