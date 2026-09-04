import { useEffect, useRef, useState } from "react";
import { savePlaySession } from "../../data/localPlaySession";
import type {
  PlayerWorkspaceContext,
  PlayerWorkspaceContribution,
  PlayerWorkspaceRequest,
} from "../../player/workspaces/types";
import {
  buildPortablePlaySession,
  downloadPortablePlaySave,
  parsePortablePlaySave,
} from "./ui/portableSave";
import "./playerWorkspace.css";

const completedAutomaticDownloads = new Set<string>();

function requestKey(context: PlayerWorkspaceContext) {
  return `${context.playState.sessionStartedAt}:${context.playState.commandsEntered}`;
}

function SessionFileWorkspace({
  request,
  context,
}: {
  request: PlayerWorkspaceRequest;
  context: PlayerWorkspaceContext;
}) {
  const mode = request.data?.mode === "load" ? "load" : "save";
  const [status, setStatus] = useState(mode === "save" ? "PREPARING SAVE FILE..." : "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const automaticKey = requestKey(context);

  const downloadCurrent = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("PREPARING SAVE FILE...");
    try {
      const session = await buildPortablePlaySession(context.snapshot, context.playState);
      downloadPortablePlaySave(session);
      context.output("[SAVE FILE DOWNLOADED]");
    } catch {
      setStatus("SAVE FILE COULD NOT BE CREATED. TRY AGAIN.");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (mode !== "save") return;
    const timer = window.setTimeout(() => {
      if (completedAutomaticDownloads.has(automaticKey)) return;
      completedAutomaticDownloads.add(automaticKey);
      void downloadCurrent().finally(() => {
        window.setTimeout(() => completedAutomaticDownloads.delete(automaticKey), 1500);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [automaticKey, mode]);

  const loadFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setStatus("READING SAVE FILE...");
    try {
      const session = parsePortablePlaySave(context.snapshot, await file.text());
      const stored = await savePlaySession({ ...session, resumeImmediately: true });
      if (!stored) throw new Error("Browser storage rejected the save file.");
      setStatus("LOADING SAVE FILE...");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message.toUpperCase() : "SAVE FILE COULD NOT BE LOADED.");
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (mode === "save") return <section className="session-file-workspace" aria-label="Save game">
    <h2>SAVE GAME</h2>
    <p>Your current run is being written to a portable <code>.ppsave</code> file.</p>
    <p className="session-file-status" role="status">{status}</p>
    <button type="button" disabled={busy} onClick={() => void downloadCurrent()}>
      [{busy ? "PREPARING..." : "DOWNLOAD AGAIN"}]
    </button>
  </section>;

  return <section className="session-file-workspace" aria-label="Load game">
    <h2>LOAD GAME</h2>
    <p>Choose a <code>.ppsave</code> file. Loading it replaces the current run in this browser and resumes that saved state.</p>
    <input
      ref={inputRef}
      className="session-file-input"
      type="file"
      accept=".ppsave,application/json"
      disabled={busy}
      onChange={(event) => void loadFile(event.target.files?.[0])}
    />
    <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
      [{busy ? "LOADING..." : "CHOOSE SAVE FILE"}]
    </button>
    {status ? <p className="session-file-status" role="status">{status}</p> : null}
  </section>;
}

export const sessionFilePlayerWorkspaceContribution: PlayerWorkspaceContribution = {
  feature: "session",
  workspace: "file",
  label: "Game Save",
  render: (request, context) => <SessionFileWorkspace request={request} context={context} />,
};
