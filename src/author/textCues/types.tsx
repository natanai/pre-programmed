import type { ReactNode } from "react";
import type { ProjectSnapshot, TextCue, TextCueType } from "../../game/model";

export type TextCueAuthorAdapter = {
  type: TextCueType;
  label: string;
  createValue?: (snapshot: ProjectSnapshot) => TextCue["value"];
  renderValue: (context: {
    cue: TextCue;
    snapshot: ProjectSnapshot;
    onValueChange: (value: TextCue["value"]) => void;
  }) => ReactNode;
};
