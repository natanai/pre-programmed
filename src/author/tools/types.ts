import type { PlayState, ProjectSnapshot } from "../../game/model";
import type { AuthorTaskRoute } from "../tasks/types";

export type AuthorToolDefinition = {
  id: string;
  label: string;
  description: string;
  /** Feature-owned concepts and control names reachable through this tool. */
  searchText?: string;
  tone?: "normal" | "draft";
  onSelect: () => void;
};

export type AuthorToolContribution = {
  groupId: string;
  groupLabel: string;
  groupOrder: number;
  toolOrder: number;
  tool: AuthorToolDefinition;
};

export type AuthorToolContext = {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  pushTask: (route: AuthorTaskRoute) => string;
  closeAll: () => void;
  downloadBackup: () => Promise<void>;
};

export type AuthorToolContributor = (context: AuthorToolContext) => readonly AuthorToolContribution[];
