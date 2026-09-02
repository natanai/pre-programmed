import type { TextCueType } from "../../features/narrative/model";
import { getAuthorTextCueAdapters } from "../features/registry";
import type { TextCueAuthorAdapter } from "./types";

/** Lazy access avoids feature-manifest cycles while keeping cue ownership modular. */
export function featureTextCueAuthorAdapters(): readonly TextCueAuthorAdapter[] {
  return getAuthorTextCueAdapters();
}

export function featureTextCueAuthorAdapter(type: TextCueType): TextCueAuthorAdapter | undefined {
  return featureTextCueAuthorAdapters().find((adapter) => adapter.type === type);
}
