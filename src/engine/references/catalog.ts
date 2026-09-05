import { INVENTORY_SEMANTIC_REFERENCE_PROVIDERS } from "../../features/inventory/semanticReferences";
import { MEDIA_SEMANTIC_REFERENCE_PROVIDERS } from "../../features/media/semanticReferences";
import { NARRATIVE_SEMANTIC_REFERENCE_PROVIDERS } from "../../features/narrative/semanticReferences";
import { STATE_SEMANTIC_REFERENCE_PROVIDERS } from "../../features/state/semanticReferences";
import { WORLD_SEMANTIC_REFERENCE_PROVIDERS } from "../../features/world/semanticReferences";
import type { SemanticReferenceProvider } from "./types";

/**
 * Runtime composition root for installed semantic-reference contributions.
 *
 * Features own candidate meaning. Consumers depend only on the engine contract,
 * so adding a feature does not require teaching @ fields or Commands its internals.
 */
export const SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  ...WORLD_SEMANTIC_REFERENCE_PROVIDERS,
  ...NARRATIVE_SEMANTIC_REFERENCE_PROVIDERS,
  ...STATE_SEMANTIC_REFERENCE_PROVIDERS,
  ...INVENTORY_SEMANTIC_REFERENCE_PROVIDERS,
  ...MEDIA_SEMANTIC_REFERENCE_PROVIDERS,
];

export function semanticReferenceProvider(kind: string) {
  return SEMANTIC_REFERENCE_PROVIDERS.find((provider) => provider.kind === kind);
}
