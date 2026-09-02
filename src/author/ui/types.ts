import type { ReactNode } from "react";

export type AuthorUiLabelMode = "auto" | "always" | "sr-only";
export type AuthorUiImportance = "primary" | "standard" | "secondary";

export type AuthorUiField = {
  type: "field";
  id: string;
  label: string;
  labelMode?: AuthorUiLabelMode;
  control?: "text" | "textarea" | "search" | "number";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
};

export type AuthorUiChoiceOption = {
  value: string;
  label: string;
  help?: string;
  content?: AuthorUiNode[];
};

export type AuthorUiChoice = {
  type: "choice";
  id: string;
  label: string;
  labelMode?: AuthorUiLabelMode;
  value: string;
  onChange: (value: string) => void;
  options: AuthorUiChoiceOption[];
  presentation?: "segmented" | "stacked";
};

export type AuthorUiSection = {
  type: "section";
  id: string;
  label: string;
  summary?: string;
  importance?: AuthorUiImportance;
  children: AuthorUiNode[];
};

export type AuthorUiDisclosure = {
  type: "disclosure";
  id: string;
  label: string;
  summary?: string;
  defaultOpen?: boolean;
  children: AuthorUiNode[];
};

/**
 * Escape hatch for a genuinely specialized control such as a rule tree,
 * sequencer, grid, or resource result list. The shared workspace renderer still
 * owns task chrome, hierarchy, and actions around this content.
 */
export type AuthorUiCustom = {
  type: "custom";
  id: string;
  role: "specialized-control" | "resource-picker" | "ordered-list" | "rule-editor" | "preview" | "results";
  content: ReactNode;
};

export type AuthorUiStatus = {
  type: "status";
  id: string;
  text: string;
  tone?: "info" | "warning" | "error" | "success";
};

export type AuthorUiNode =
  | AuthorUiField
  | AuthorUiChoice
  | AuthorUiSection
  | AuthorUiDisclosure
  | AuthorUiCustom
  | AuthorUiStatus;

export type AuthorUiAction = {
  id: string;
  label: string;
  onAction: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

/**
 * Declarative Author workspace contract.
 *
 * Features describe authoring intent; the shared renderer owns visual hierarchy,
 * responsive presentation, task chrome, and action placement. There is exactly
 * one task title and one task-level action area in this structure.
 */
export type AuthorWorkspaceSpec = {
  id: string;
  title: string;
  context?: string;
  blocks: AuthorUiNode[];
  actions?: AuthorUiAction[];
};
