import { getAuthorTextCueAdapters } from "../features/registry";
import type { TextCueAuthorAdapter } from "./types";

/** Lazy access avoids feature-manifest cycles while keeping command ownership modular. */
export function featureTextCueAuthorAdapters(): readonly TextCueAuthorAdapter[] {
  return getAuthorTextCueAdapters();
}

export function featureTextCueAuthorAdapterForCode(code: string): TextCueAuthorAdapter | undefined {
  return featureTextCueAuthorAdapters().find((adapter) => adapter.inlineCode === code);
}
