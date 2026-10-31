import { referencesTo } from "../../../author/references/projectReferences";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { repositoryPremidiAssets } from "../ui/premidiRepository";
import { parse, filename, type PremidiComposition } from "../vendor/premidi-schema.js";
import { play } from "../vendor/premidi-audio.js";

// Legacy v2 project music is still readable/exportable. This screen does not
// create or upload music: current scores live in discovered repository Assets.
function download(doc: PremidiComposition) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename(doc, ".premidi");
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
let previewSession: { stop: () => void } | null = null;
async function preview(composition: PremidiComposition) {
  previewSession?.stop();
  previewSession = await play(composition);
}

export const mediaCompositionsWorkspace = defineAuthorWorkspace({
  id: "media-premidi-library",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "compositions",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const files = repositoryPremidiAssets(context.snapshot);
    const legacy = context.snapshot.mediaCompositions ?? [];
    return {
      id: "media-premidi-library",
      title: "Compositions",
      context: `${files.length} music file${files.length === 1 ? "" : "s"}`,
      blocks: [
        {
          type: "status",
          id: "media-premidi-discovery",
          text: "Music is discovered automatically from assets/ beside the portable application when it launches, or public/assets/ at website build time. No upload or import is needed.",
        },
        ...(files.length || legacy.length ? [{
          type: "list" as const,
          id: "media-premidi-list",
          label: "Compositions",
          items: [
            ...files.map((asset) => ({
              id: "premidi-file:" + asset.id,
              label: asset.name,
              detail: "Repository .premidi · " + asset.byteLength + " bytes",
              onAction: () => context.pushTask({
                type: "feature", feature: "media", workspace: "asset",
                data: { assetId: asset.id, kind: "audio" },
              }),
            })),
            ...legacy.map((composition) => ({
              id: "premidi-legacy:" + composition.id,
              label: composition.title,
              detail: "Legacy v2 · " + composition.instruments.length + " instruments",
              onAction: () => context.pushTask({
                type: "feature", feature: "media", workspace: "composition",
                data: { compositionId: composition.id },
              }),
            })),
          ],
        }] : [{
          type: "status" as const,
          id: "media-premidi-empty",
          text: "No .premidi files were found in the installation's assets folder.",
        }]),
      ],
    };
  },
});

export const mediaCompositionWorkspace = defineAuthorWorkspace({
  id: "media-premidi-composition",
  matches: (route) => route.type === "feature" && route.feature === "media" && route.workspace === "composition",
  createDraft: () => ({}),
  buildSpec: ({ route, context }) => {
    const composition = context.snapshot.mediaCompositions?.find((candidate) => candidate.id === route.data?.compositionId);
    if (!composition) return {
      id: "media-premidi-composition", title: "Missing composition",
      blocks: [{ type: "status" as const, id: "missing-premidi", tone: "error" as const, text: "This native composition is unavailable." }],
    };
    const uses = referencesTo(context.snapshot, "media-sound", composition.id);
    return {
      id: "media-premidi-composition",
      title: composition.title,
      context: "Native pre-midi composition",
      blocks: [{
        type: "section",
        id: "premidi-details",
        label: "Composition",
        importance: "primary",
        children: [
          { type: "status", id: "premidi-summary", text: composition.instruments.length + " instruments · " + composition.bars + " bars · " + composition.bpm + " BPM" },
          { type: "status", id: "premidi-id", text: "STABLE MEDIA ID · " + composition.id },
          { type: "status", id: "premidi-editing", text: "This is a legacy v2 score already saved in this project. New .premidi music is discovered from the assets folder instead of being imported into the project." },
        ],
      }],
      actions: [
        { id: "premidi-preview", label: "PLAY COMPOSITION", onAction: () => { void preview(composition).catch(console.warn); } },
        { id: "premidi-stop", label: "STOP PREVIEW", onAction: () => previewSession?.stop() },
        { id: "premidi-export", label: "EXPORT .PREMIDI", onAction: () => download(composition) },
        {
          id: "premidi-delete",
          label: "DELETE" + (uses.length ? " · " + uses.length + " USES" : ""),
          tone: "danger",
          disabled: uses.length > 0,
          onAction: () => {
            if (!window.confirm("Delete composition " + composition.title + "?")) return;
            void context.persist([{ type: "premidi.delete", id: composition.id }], "Deleted " + composition.title)
              .then((result) => { if (result.status === "saved" || result.status === "queued") context.leaveCurrentTask(); });
          },
        },
      ],
    };
  },
});
