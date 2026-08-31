import type { GameNode, Interaction } from "../../game/model";
import type { AuthorPanelRoute } from "../workSurfaceNavigation";

export type AuthorToolDefinition = {
  id: string;
  label: string;
  description: string;
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
  currentNode: GameNode;
  fallbackInput?: Interaction;
  invalidDraft: boolean;
  notationForInput: (interaction: Interaction) => string;
  pushPanel: (route: AuthorPanelRoute) => void;
  pushInventory: () => void;
  close: () => void;
  downloadBackup: () => Promise<void>;
};

export type AuthorToolContributor = (context: AuthorToolContext) => readonly AuthorToolContribution[];
