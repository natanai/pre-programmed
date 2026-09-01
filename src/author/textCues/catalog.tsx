import type { TextCueType } from "../../game/model";
import type { TextCueAuthorAdapter } from "./types";

export const FEATURE_TEXT_CUE_AUTHOR_ADAPTERS: readonly TextCueAuthorAdapter[] = [];

export const FEATURE_TEXT_CUE_AUTHOR_ADAPTER_BY_TYPE = Object.fromEntries(
  FEATURE_TEXT_CUE_AUTHOR_ADAPTERS.map((adapter) => [adapter.type, adapter]),
) as Partial<Record<TextCueType, TextCueAuthorAdapter>>;
