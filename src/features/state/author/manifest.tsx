import type { AuthorFeatureManifest } from "../../../author/features/types";
import { DefinitionsPanel } from "./DefinitionsPanel";
import { stateAuthorTools } from "./tools";

export const stateAuthorFeature: AuthorFeatureManifest = {
  id: "state",
  tools: stateAuthorTools,
  renderWorkspace(route, context) {
    if (route.type !== "definitions") return null;
    return <DefinitionsPanel
      snapshot={context.snapshot}
      onSave={context.persist}
      onClose={context.leaveCurrentSurface}
    />;
  },
};
