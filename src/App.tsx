import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  type GameNode,
  type ProjectBootstrap,
  UNIVERSE_DRIVE_PROMPT,
} from "./game/opening";

const API_ORIGIN = "https://pre-programmed.natanai.workers.dev";
const AUTHOR_TOKEN_KEY = "pre-programmed:author-token";

function apiUrl(path: string) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `http://localhost:8787${path}`;
  }
  return `${API_ORIGIN}${path}`;
}

function useTypewriter(text: string, charactersPerSecond: number) {
  const [count, setCount] = useState(0);
  const intervalMs = useMemo(
    () => Math.max(16, Math.round(1000 / Math.max(1, charactersPerSecond))),
    [charactersPerSecond],
  );

  useEffect(() => {
    setCount(0);
    if (!text) return;

    const interval = window.setInterval(() => {
      setCount((current) => {
        if (current >= text.length) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [text, intervalMs]);

  return {
    visibleText: text.slice(0, count),
    complete: count >= text.length,
    completeImmediately: () => setCount(text.length),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [node, setNode] = useState<GameNode | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [command, setCommand] = useState("");
  const [requestingKey, setRequestingKey] = useState(false);
  const [authorToken, setAuthorToken] = useState(
    () => sessionStorage.getItem(AUTHOR_TOKEN_KEY) ?? "",
  );
  const [authorMode, setAuthorMode] = useState(false);
  const [authorMessage, setAuthorMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  const clearAuthorSession = () => {
    sessionStorage.removeItem(AUTHOR_TOKEN_KEY);
    setAuthorToken("");
    setAuthorMode(false);
  };

  useEffect(() => {
    let cancelled = false;
    void fetch(apiUrl("/api/project/bootstrap"))
      .then((response) => readJson<ProjectBootstrap>(response))
      .then((bootstrap) => {
        if (cancelled) return;
        setNode(bootstrap.startNode);
        setRevision(bootstrap.revision);
        setDraftText(bootstrap.startNode.text);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authorToken) return;
    let cancelled = false;
    void fetch(apiUrl("/api/author/check"), {
      method: "POST",
      headers: { Authorization: `Bearer ${authorToken}` },
    }).then((response) => {
      if (cancelled) return;
      if (response.ok) {
        setAuthorMode(true);
      } else {
        clearAuthorSession();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authorToken]);

  const typewriter = useTypewriter(
    node?.text ?? "",
    node?.performance.charactersPerSecond ?? 18,
  );

  const focusTerminal = () => {
    if (!editing) terminalInputRef.current?.focus();
  };

  const downloadBackup = async () => {
    if (!authorToken) return;
    setAuthorMessage("BACKING UP...");
    try {
      const response = await fetch(apiUrl("/api/author/backup"), {
        headers: { Authorization: `Bearer ${authorToken}` },
      });
      if (response.status === 401) {
        clearAuthorSession();
        setAuthorMessage("AUTHOR SESSION EXPIRED.");
        return;
      }
      if (!response.ok) throw new Error(await response.text());

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `pre-programmed-backup-${Date.now()}.json`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setAuthorMessage("BACKUP DOWNLOADED.");
    } catch {
      setAuthorMessage("BACKUP FAILED.");
    }
  };

  const handleTerminalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = command;
    const normalized = value.trim().toLowerCase();
    setCommand("");
    setAuthorMessage("");

    if (requestingKey) {
      try {
        const response = await fetch(apiUrl("/api/author/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: value }),
        });
        const result = await readJson<{ token: string; expiresAt: string }>(response);
        sessionStorage.setItem(AUTHOR_TOKEN_KEY, result.token);
        setAuthorToken(result.token);
        setAuthorMode(true);
        setRequestingKey(false);
        setAuthorMessage("AUTHOR MODE.");
      } catch {
        setAuthorMessage("ACCESS DENIED.");
      }
      return;
    }

    if (normalized === "admin") {
      if (authorMode) {
        setAuthorMessage("AUTHOR MODE.");
      } else {
        setRequestingKey(true);
      }
      return;
    }

    if (authorMode && (normalized === "backup" || normalized === "/backup")) {
      await downloadBackup();
      return;
    }

    // Gameplay command routing intentionally begins in the next vertical slice.
  };

  const saveNode = async () => {
    if (!node || !authorToken || saving) return;
    setSaving(true);
    setAuthorMessage("SAVING...");
    try {
      const response = await fetch(apiUrl(`/api/author/nodes/${encodeURIComponent(node.id)}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: draftText,
          charactersPerSecond: node.performance.charactersPerSecond,
        }),
      });
      if (response.status === 401) {
        clearAuthorSession();
        setAuthorMessage("AUTHOR SESSION EXPIRED.");
        return;
      }
      const result = await readJson<{ node: GameNode; revision: number }>(response);
      setNode(result.node);
      setRevision(result.revision);
      setDraftText(result.node.text);
      setEditing(false);
      setAuthorMessage(`SAVED R${result.revision}.`);
    } catch {
      setAuthorMessage("SAVE FAILED.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <main className="dos-screen">
        <div className="dos-terminal">SYSTEM ERROR: UNIVERSE UNAVAILABLE.</div>
      </main>
    );
  }

  if (!node) {
    return <main className="dos-screen" aria-label="Pre-Programmed terminal" />;
  }

  const promptLabel = requestingKey ? "ADMIN KEY>" : UNIVERSE_DRIVE_PROMPT;
  const mirroredCommand = requestingKey ? "*".repeat(command.length) : command;

  return (
    <main
      className="dos-screen"
      aria-label="Pre-Programmed terminal"
      onPointerDown={() => {
        if (!typewriter.complete) {
          typewriter.completeImmediately();
          return;
        }
        focusTerminal();
      }}
    >
      <div className="dos-terminal" aria-live="polite">
        {authorMode ? <div className="author-status">[AUTHOR] #{node.nodeNumber} R{revision}</div> : null}

        {authorMode && typewriter.complete ? (
          <button
            type="button"
            className="story-edit-target"
            onClick={(event) => {
              event.stopPropagation();
              setDraftText(node.text);
              setEditing(true);
            }}
            aria-label="Edit current node text"
          >
            {node.text}
          </button>
        ) : (
          <div className="story-line">{typewriter.visibleText}</div>
        )}

        {editing ? (
          <div className="author-editor" onPointerDown={(event) => event.stopPropagation()}>
            <label htmlFor="node-text">NODE #{node.nodeNumber} TEXT</label>
            <textarea
              id="node-text"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              autoFocus
            />
            <div className="author-actions">
              <button type="button" onClick={() => void saveNode()} disabled={saving}>[SAVE]</button>
              <button
                type="button"
                onClick={() => {
                  setDraftText(node.text);
                  setEditing(false);
                  setAuthorMessage("");
                }}
                disabled={saving}
              >
                [CANCEL]
              </button>
            </div>
          </div>
        ) : null}

        {typewriter.complete && !editing ? (
          <form className="prompt-line" onSubmit={(event) => void handleTerminalSubmit(event)}>
            <span>{promptLabel}</span>
            <span>{mirroredCommand}</span>
            <span className="dos-cursor" aria-hidden="true" />
            <input
              ref={terminalInputRef}
              className="terminal-input"
              type={requestingKey ? "password" : "text"}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={requestingKey ? "Author key" : "Universe command"}
            />
          </form>
        ) : null}

        {authorMessage ? <div className="author-message">{authorMessage}</div> : null}
      </div>
    </main>
  );
}
