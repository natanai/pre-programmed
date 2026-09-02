import { AUTHOR_FEATURES } from "../features/registry";
import type { AuthorCapabilityContext, AuthorCapabilityRequest, AuthorCapabilityResolution } from "./types";

/**
 * Resolve a semantic Author request without teaching the shell which feature
 * implements it. A request must have at most one owner in the installed build.
 */
export function resolveAuthorCapability(
  request: AuthorCapabilityRequest,
  context: AuthorCapabilityContext,
): AuthorCapabilityResolution | null {
  let match: AuthorCapabilityResolution | null = null;
  let owner = "";
  for (const feature of AUTHOR_FEATURES) {
    for (const capability of feature.capabilities ?? []) {
      if (capability.id !== request.capability) continue;
      const resolved = capability.resolve(request, context);
      if (!resolved) continue;
      if (match) throw new Error(`Author capability ${request.capability} is owned by both ${owner} and ${feature.id}.`);
      match = resolved;
      owner = feature.id;
    }
  }
  return match;
}
