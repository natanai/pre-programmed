import { createContext, useContext, type ReactNode } from "react";
import type { PlayState } from "../../engine/project/model";

const AuthorPlayStateContext = createContext<PlayState | null>(null);

/** Live player context shared by every nested Author task; it is not a second run state. */
export function AuthorPlayStateProvider({ state, children }: { state: PlayState; children: ReactNode }) {
  return <AuthorPlayStateContext.Provider value={state}>{children}</AuthorPlayStateContext.Provider>;
}

export function useAuthorPlayStateOptional() {
  return useContext(AuthorPlayStateContext);
}
