import { mediaSearchDocuments } from "../../features/media/author/search";
import type { SearchDocumentContribution } from "./types";

/** Explicit composition root for optional feature documents in global Author search. */
export const AUTHOR_SEARCH_DOCUMENT_CONTRIBUTIONS: readonly SearchDocumentContribution[] = [
  mediaSearchDocuments,
];
