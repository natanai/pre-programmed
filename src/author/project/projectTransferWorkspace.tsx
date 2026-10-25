import { AuthorHelp } from "../ui/AuthorHelp";
import { useState } from "react";
import { downloadAuthorProject, importAuthorProject } from "../../data/api";
import type { ProjectSnapshot } from "../../engine/project/model";
import { defineAuthorWorkspace } from "../ui/workspaceDefinition";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the Blob URL alive while Electron presents its native Save As dialog.
  // Revoking it in the same task can race the download handoff on Windows.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ProjectTransferControl({
  authorToken,
  onSnapshot,
}: {
  authorToken: string;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const exportProject = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("EXPORTING PROJECT...");
    try {
      const { blob, filename } = await downloadAuthorProject(authorToken);
      downloadBlob(blob, filename);
      // A triggered download may still be in the OS Save As dialog.
      setStatus("PROJECT EXPORT READY. SAVE THE .PPGAME FILE WHEN PROMPTED.");
    } catch (error) {
      setStatus(error instanceof Error ? `EXPORT FAILED: ${error.message}` : "EXPORT FAILED.");
    } finally {
      setBusy(false);
    }
  };

  const importProject = async (file: File | null) => {
    if (!file || busy) return;
    if (!window.confirm(`Replace the current authored project with ${file.name}? You can undo the import from History if needed.`)) return;
    setBusy(true);
    setStatus("IMPORTING PROJECT...");
    try {
      const snapshot = await importAuthorProject(authorToken, file);
      onSnapshot(snapshot);
      setStatus(`PROJECT IMPORTED. SAVED R${snapshot.revision}.`);
    } catch (error) {
      setStatus(error instanceof Error ? `IMPORT FAILED: ${error.message}` : "IMPORT FAILED.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="author-project-transfer">
    <div className="author-ui-field-heading"><span>PORTABLE GAME FILE</span><AuthorHelp label="About project import and export" text="A .ppgame contains the authored game, generated vectors, and Synths. Run bookmarks remain with this installation. External image and audio files must be copied separately into the destination assets folder to reconnect by their asset IDs." /></div>
    <div className="author-project-transfer-actions">
      <button type="button" onClick={() => { void exportProject(); }} disabled={busy}>EXPORT PROJECT</button>
      <label>
        IMPORT PROJECT
        <input
          type="file"
          accept=".ppgame,application/json,application/vnd.pre-programmed.project+json"
          disabled={busy}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0] ?? null;
            void importProject(file).finally(() => { input.value = ""; });
          }}
        />
      </label>
    </div>
    {status ? <p aria-live="polite">{status}</p> : null}
  </div>;
}

export const projectTransferAuthorWorkspace = defineAuthorWorkspace<null>({
  id: "project-transfer",
  matches: (route) => route.type === "feature" && route.feature === "project" && route.workspace === "transfer",
  createDraft: () => null,
  buildSpec: ({ context }) => ({
    id: "project-transfer",
    title: "Project file",
    context: "Move an authored game between Pre-Programmed installations without copying an engine database.",
    blocks: [{
      type: "custom",
      id: "project-transfer-control",
      role: "specialized-control",
      content: <ProjectTransferControl authorToken={context.authorToken} onSnapshot={context.onSnapshot} />,
    }],
  }),
});
