import type { AuthorFeatureManifest } from "../../../author/features/types";
import { AssetExplorer } from "./AssetExplorer";
import { SynthPanel } from "./SynthPanel";
import { mediaAuthorTools } from "./tools";

export const mediaAuthorFeature: AuthorFeatureManifest = {
  id: "media",
  tools: mediaAuthorTools,
  renderWorkspace(route, context) {
    if (route.type === "assets") return <AssetExplorer
      snapshot={context.snapshot}
      onClose={context.leaveCurrentSurface}
    />;

    if (route.type === "synth") return <SynthPanel
      snapshot={context.snapshot}
      onSave={context.persist}
      onClose={context.leaveCurrentSurface}
    />;

    return null;
  },
};
