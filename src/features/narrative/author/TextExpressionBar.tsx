import type { RefObject } from "react";
import { TextRulesReference } from "./TextRulesReference";

export type TextSelection = { start: number; end: number };

/**
 * Transitional compatibility facade for InteractionEditor.
 *
 * Text performance is now authored directly with Narrative's inline notation;
 * the UI only provides a compact reminder. Keep this prop shape until the
 * larger Interaction editor is next split, then import TextRulesReference
 * directly and delete this facade.
 */
export function TextExpressionBar(_: {
  value: string;
  selection: TextSelection;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string, selection: TextSelection) => void;
}) {
  return <TextRulesReference />;
}
