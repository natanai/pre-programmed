import { MEDIA_TEXT_CUE_AUTHOR_ADAPTERS } from "../../features/media/author/textCueAdapters";
import type { TextCueType } from "../../game/model";
import type { TextCueAuthorAdapter } from "./types";

/** Explicit composition root for optional feature controls in Narrative cue authoring. */
export const FEATURE_TEXT_CUE_AUTHOR_ADAPTERS: readonly TextCueAuthorAdapter[] = [
  ...MEDIA_TEXT_CUE_AUTHOR_ADAPTERS,
];

export const FEATURE_TEXT_CUE_AUTHOR_ADAPTER_BY_TYPE = Object.fromEntries(
  FEATURE_TEXT_CUE_AUTHOR_ADAPTERS.map((adapter) => [adapter.type, adapter]),
) as Partial<Record<TextCueType, TextCueAuthorAdapter>>;
