export type AuthorTaskRoute =
  | { type: "tools" }
  | { type: "workspace"; view?: "locations" | "history" }
  | { type: "feature"; feature: string; workspace: string; data?: Record<string, string> };

export type AuthorResourceResult = {
  type: "resource";
  kind: string;
  id: string;
  value: string;
  label: string;
};

export type AuthorTaskResult = AuthorResourceResult | { type: "saved" };

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
