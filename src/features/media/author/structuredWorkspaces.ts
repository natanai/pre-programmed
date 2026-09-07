import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";

export const mediaSynthLibraryWorkspace = defineAuthorWorkspace({
  id: "media-synth-library",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "synth",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const sounds = context.snapshot.synthSounds;
    return {
      id: "media-synth-library",
      title: "Synth sounds",
      context: `${sounds.length} sound${sounds.length === 1 ? "" : "s"}`,
      blocks: [
        ...(sounds.length ? [{
          type: "action-row" as const,
          id: "media-synth-list",
          actions: sounds.map((sound) => ({
            id: `media-synth:${sound.id}`,
            label: `${sound.label || sound.key || "UNTITLED"} · ${sound.voices.length} VOICE${sound.voices.length === 1 ? "" : "S"} · ${sound.tempo} BPM`,
            onAction: () => context.pushTask({
              type: "feature",
              feature: "media",
              workspace: "synth-sound",
              data: { soundId: sound.id },
            }),
          })),
        }] : [{
          type: "status" as const,
          id: "media-synth-empty",
          text: "NO SYNTH SOUNDS YET.",
        }]),
      ],
      actions: [{
        id: "media-synth-create",
        label: "+ SOUND",
        onAction: () => context.pushTask({
          type: "feature",
          feature: "media",
          workspace: "synth-sound",
          data: { soundId: "new" },
        }),
      }],
    };
  },
});

export const MEDIA_STRUCTURED_WORKSPACES = [mediaSynthLibraryWorkspace] as const;
