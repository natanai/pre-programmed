import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  type GameNode,
  type ProjectBootstrap,
  UNIVERSE_DRIVE_PROMPT,
} from "./game/opening";

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
  const [authorKey, setAuthorKey] = useState(() => sessionStorage.getItem("pre-programmed:author-key") ?? "");
  const [authorMode, setAuthorMode] = useState(false);
  const [authorMessage, setAuthorMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/project/bootstrap")
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
    if (!authorKey) return;
    let cancelled = false;
    void fetch("/api/author/check", {
      method: "POST",
      headers: { Authorization: `Bearer ${authorKey}` },
    }).then((response) => {
      if (cancelled) return;
      if (response.ok) {
        setAuthorMode(true);
      } else {
        sessionStorage.removeItem("pre-programmed:author-key");
        setAuthorKey("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authorKey]);

  const typewriter = useTypewriter(
    node?.text ?? "",
    node?.performance.charactersPerSecond ?? 18,
  );

  const focusTerminal = () => {
    if (!editing) terminalInputRef.current?.focus();
  };

  const handleTerminalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = command;
    setCommand("");
    setAuthorMessage("");

    if (requestingKey) {
      const response = await fetch("/api/author/check", {
        method: "POST",
        headers: { Authorization: `Bearer ${value}` },
      });
      if (response.ok) {
        sessionStorage.setItem("pre-programmed:author-key", value);
        setAuthorKey(value);
        setAuthorMode(true);
        setRequestingKey(false);
        setAuthorMessage("AUTHOR MODE.");
      } else {
        setAuthorMessage("ACCESS DENIED.");
      }
      return;
    }

    if (value.trim().toLowerCase() === "admin") {
      setRequestingKey(true);
      return;
    }

    // Gameplay command routing intentionally begins in the next vertical slice.
  };

  const saveNode = async () => {
    if (!node || !authorKey || saving) return;
    setSaving(true);
    setAuthorMessage("SAVING...");
    try {
      const response = await fetch(`/api/author/nodes/${encodeURIComponent(node.id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authorKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: draftText,
          charactersPerSecond: node.performance.charactersPerSecond,
        }),
      });
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
