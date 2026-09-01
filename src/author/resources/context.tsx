import { createContext, useContext, type ReactNode } from "react";
import type { AuthorResourceTools } from "./types";

const AuthorResourceContext = createContext<AuthorResourceTools | null>(null);

export function AuthorResourceProvider({ tools, children }: { tools: AuthorResourceTools; children: ReactNode }) {
  return <AuthorResourceContext.Provider value={tools}>{children}</AuthorResourceContext.Provider>;
}

export function useAuthorResourceTools() {
  const tools = useContext(AuthorResourceContext);
  if (!tools) throw new Error("Author resource tools are only available inside an Author task.");
  return tools;
}
