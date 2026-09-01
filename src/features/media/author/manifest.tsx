import type { AuthorFeatureManifest } from "../../../author/features/types";
import { AssetExplorer } from "./AssetExplorer";
import { SynthEditor, SynthPanel } from "./SynthPanel";
import { mediaAuthorTools } from "./tools";

export const mediaAuthorFeature: AuthorFeatureManifest = {
  id: "media",
  tools: mediaAuthorTools,
  terminalShortcuts: [
    { commands: ["/assets", "assets"], route: { type: "feature", feature: "media", workspace: "assets" } },
    { commands: ["/sounds", "sounds"], route: { type: "feature", feature: "media", workspace: "synth" } },
  ],
  renderWorkspace(route, context) {
    if (route.type === "feature" && route.feature === "media" && route.workspace === "assets") return <AssetExplorer
      snapshot={context.snapshot}
      onClose={context.leaveCurrentSurface}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "synth") return <SynthPanel
      snapshot={context.snapshot}
      onOpenSound={(sound) => context.pushPanel({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: sound.id },
      })}
      onNewSound={() => context.pushPanel({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: "new" },
      })}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "synth-sound") {
      const soundId = route.data?.soundId ?? "new";
      const sound = soundId === "new"
        ? undefined
        : context.snapshot.synthSounds.find((candidate) => candidate.id === soundId);
      return <SynthEditor
        snapshot={context.snapshot}
        initial={sound}
        onSave={(operations, description) => context.persist(operations, description)}
        setWorkspaceDirty={context.setWorkspaceDirty}
      />;
    }

    return null;
  },
};
