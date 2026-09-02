import type { AuthorFeatureManifest } from "../../../author/features/types";
import { WORLD_COMMAND_REFERENCE_SOURCES } from "../commandReferences";
import { WORLD_AUTHOR_OPERATION_DEFINITIONS } from "../operationAdapter";

/** World owns its command vocabulary and operation capabilities. */
export const worldAuthorFeature: AuthorFeatureManifest = {
  id: "world",
  commandReferences: WORLD_COMMAND_REFERENCE_SOURCES,
  operations: WORLD_AUTHOR_OPERATION_DEFINITIONS,
};
