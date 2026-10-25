import { AuthorHelp } from "../../../author/ui/AuthorHelp";
import { useState } from "react";
import { referencesTo } from "../../../author/references/projectReferences";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { parse, filename, type PremidiComposition } from "../vendor/premidi-schema.js";
import { play } from "../vendor/premidi-audio.js";

function download(doc: PremidiComposition) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename(doc, ".premidi");
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function ImportComposition({ onImport }: { onImport: (doc: PremidiComposition) => Promise<string> }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="media-premidi-import">
    <label>
      IMPORT .PREMIDI
      <input
        type="file"
        accept=".premidi,application/json"
        disabled={busy}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          const input = event.currentTarget;
          setBusy(true);
          try {
            if (file.size > 1_000_000) throw new Error("Composition file exceeds the 1 MB limit.");
            const composition = parse(await file.text());
            setMessage(await onImport(composition));
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Import failed.");
          } finally {
            input.value = "";
            setBusy(false);
          }
        }}
      />
    </label>
    <AuthorHelp label="About importing compositions" text="A .premidi file stores a playable music score, not a recording. Compose it in pre-midi, then import it into this project." />
    {message ? <p role="status">{message}</p> : null}
  </div>;
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
  buildSpec: ({ context }) => ({
    id: "media-premidi-library",
    title: "Compositions",
    context: String(context.snapshot.mediaCompositions?.length ?? 0) + " native scores",
    blocks: [{
      type: "custom",
      id: "media-premidi-import-control",
      role: "specialized-control",
      content: <ImportComposition onImport={async (composition) => {
        const exists = context.snapshot.mediaCompositions?.some((entry) => entry.id === composition.id);
        if (exists && !window.confirm("Replace existing composition " + composition.title + "? Existing references will keep the same ID.")) {
          return "Import canceled. The original composition was not changed.";
        }
        const result = await context.persist(
          [{ type: "premidi.upsert", composition }],
          (exists ? "Updated " : "Imported ") + composition.title,
        );
        if (result.status === "saved" || result.status === "queued") return "Imported " + composition.title + ".";
        throw new Error(result.status === "conflict"
          ? "The project changed during import. Please try again."
          : result.message ?? "The composition could not be saved.");
      }} />,
    }, ...(context.snapshot.mediaCompositions?.length ? [{
      type: "list" as const,
      id: "media-premidi-list",
      label: "Compositions",
      items: context.snapshot.mediaCompositions.map((composition) => ({
        id: "premidi:" + composition.id,
        label: composition.title,
        detail: composition.instruments.length + " instruments · " + composition.bars + " bars · " + composition.bpm + " BPM",
        onAction: () => context.pushTask({
          type: "feature", feature: "media", workspace: "composition",
          data: { compositionId: composition.id },
        }),
      })),
    }] : [{
      type: "status" as const,
      id: "media-premidi-empty",
      text: "No native compositions yet. Export a .premidi from pre-midi and import it here.",
    }])],
  }),
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
          { type: "status", id: "premidi-editing", text: "Edit notes, chunks and instrument settings in pre-midi, then reimport with the same ID to update this resource without breaking references." },
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
