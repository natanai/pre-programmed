import type { AuthorFeatureManifest } from "../../../author/features/types";
import { AssetExplorer } from "./AssetExplorer";
import { SynthEditor, SynthPanel } from "./SynthPanel";
import { mediaAuthorTools } from "./tools";

export const mediaAuthorFeature: AuthorFeatureManifest = {
  id: "media",
  tools: mediaAuthorTools,
  resources: [
    {
      kind: "synth-sound",
      label: "Synth Sound",
      pluralLabel: "Synth Sounds",
      list: (snapshot) => snapshot.synthSounds.map((sound) => ({
        id: sound.id,
        value: sound.id,
        label: sound.label || sound.key || "Untitled sound",
        detail: sound.key,
      })),
      createRoute: () => ({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: "new", resourceTask: "synth-sound" },
      }),
      editRoute: (resource) => ({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: resource.id, resourceTask: "synth-sound" },
      }),
    },
  ],
  terminalShortcuts: [
    { commands: ["/assets", "assets"], route: { type: "feature", feature: "media", workspace: "assets" } },
    { commands: ["/sounds", "sounds"], route: { type: "feature", feature: "media", workspace: "synth" } },
  ],
  renderWorkspace(route, context) {
    if (route.type === "feature" && route.feature === "media" && route.workspace === "assets") return <AssetExplorer
      snapshot={context.snapshot}
      onClose={context.leaveCurrentTask}
    />;

    if (route.type === "feature" && route.feature === "media" && route.workspace === "synth") return <SynthPanel
      snapshot={context.snapshot}
      onOpenSound={(sound) => context.pushTask({
        type: "feature",
        feature: "media",
        workspace: "synth-sound",
        data: { soundId: sound.id },
      })}
      onNewSound={() => context.pushTask({
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
      const resourceTask = route.data?.resourceTask === "synth-sound";
      return <SynthEditor
        snapshot={context.snapshot}
        initial={sound}
        onSave={async (operations, description) => {
          const result = await context.persist(operations, description);
          if (resourceTask && (result.status === "saved" || result.status === "queued")) {
            const operation = operations.find((candidate) => candidate.type === "synth.upsert");
            if (operation?.type === "synth.upsert") context.completeTask({
              type: "resource",
              kind: "synth-sound",
              id: operation.sound.id,
              value: operation.sound.id,
              label: operation.sound.label || operation.sound.key || "Untitled sound",
            });
          }
          return result;
        }}
        setWorkspaceDirty={context.setWorkspaceDirty}
      />;
    }

    return null;
  },
};
