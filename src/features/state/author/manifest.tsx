import type { AuthorFeatureManifest } from "../../../author/features/types";
import { DefinitionsPanel } from "./DefinitionsPanel";
import { stateAuthorTools } from "./tools";

const DEFINITIONS_ROUTE = { type: "feature", feature: "state", workspace: "definitions" } as const;

export const stateAuthorFeature: AuthorFeatureManifest = {
  id: "state",
  tools: stateAuthorTools,
  terminalShortcuts: [
    { commands: ["/definitions", "definitions"], route: DEFINITIONS_ROUTE },
  ],
  renderWorkspace(route, context) {
    if (route.type !== "feature" || route.feature !== "state" || route.workspace !== "definitions") return null;
    return <DefinitionsPanel
      snapshot={context.snapshot}
      onSave={async (operations, description) => {
        await context.persist(operations, description);
      }}
      onClose={context.leaveCurrentSurface}
    />;
  },
};
