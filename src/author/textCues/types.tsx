import type { ReactNode } from "react";
import type { ProjectSnapshot } from "../../engine/project/model";
import type { TextCueType } from "../../features/narrative/model";
import type { ResourceReference } from "../references/types";

/**
 * Feature-owned Author contribution for a slash command that compiles to a
 * runtime text cue. The authored string remains the source of truth.
 */
export type TextCueAuthorAdapter = {
  type: TextCueType;
  inlineCode: string;
  label: string;
  category: string;
  description: string;
  references?: (value: string, snapshot: ProjectSnapshot) => readonly ResourceReference[];
  renderValue?: (context: {
    value: string;
    snapshot: ProjectSnapshot;
    onValueChange: (value: string) => void;
  }) => ReactNode;
};
