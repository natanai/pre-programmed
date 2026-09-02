import type { ReactNode } from "react";
import type { ProjectSnapshot } from "../../engine/project/model";
import type { TextCue, TextCueType } from "../../features/narrative/model";
import type { ResourceReference } from "../references/types";

export type TextCueAuthorAdapter = {
  type: TextCueType;
  label: string;
  createValue?: (snapshot: ProjectSnapshot) => TextCue["value"];
  references?: (cue: TextCue) => readonly ResourceReference[];
  renderValue: (context: {
    cue: TextCue;
    snapshot: ProjectSnapshot;
    onValueChange: (value: TextCue["value"]) => void;
  }) => ReactNode;
};
