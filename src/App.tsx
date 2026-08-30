import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AssetExplorer, SynthPanel, WorkspacePanel } from "./components/AuthorTools";
import { DefinitionsPanel } from "./components/DefinitionsPanel";
import { InteractionEditor } from "./components/InteractionEditor";
import { Inventory, ItemEditor } from "./components/Inventory";
import { NodeEditor } from "./components/NodeEditor";
import { StructureNavigator } from "./components/StructureNavigator";
import {
  apiUrl,
  authorLoginErrorMessage,
  fetchProjectSnapshot,
  readJson,
  submitProjectMutation,
  waitForProjectSnapshot,
} from "./data/api";
import {
  listQueuedMutations,
  loadCachedSnapshot,
  queueMutation,
  removeQueuedMutation,
  saveCachedSnapshot,
} from "./data/localProject";
import { assetUrl } from "./data/assets";
import { type EffectEvent } from "./game/effects";
import { buildGraphIndex, notationForNode } from "./game/graph";
import { interpolateText } from "./game/interpolation";
import { applyOperations } from "./game/mutations";
import {
  createEmptyPlayState,
  reconcilePlayState,
  type AuthorBookmark,
  type GameNode,
  type Interaction,
  type ItemDefinition,
  type MutationOperation,
  type PlayState,
  type ProjectMutation,
  type ProjectSnapshot,
  type TextPerformance,
} from "./game/model";
import { parseCommand, type ParserResult } from "./game/parser";
import { executeInteraction } from "./game/runtime";
import { playSynthSound } from "./game/synth";
import { UNIVERSE_DRIVE_PROMPT } from "./game/opening";

const AUTHOR_TOKEN_KEY = "pre-programmed:author-token";

type TranscriptLine = { id: string; text: string; nodeId?: string; command?: boolean };
type Panel =
  | { type: "node"; node: GameNode }
  | { type: "interaction"; interaction?: Interaction; command?: string }
  | { type: "definitions" }
  | { type: "structure" }
  | { type: "assets" }
  | { type: "synth" }
  | { type: "workspace" }
  | { type: "item"; item?: ItemDefinition }
  | null;

function delayForPosition(performance: TextPerformance, position: number) {
  const speedCue = performance.cues.find((cue) => cue.type === "speed" && cue.start <= position && cue.end > position);
  const speed = typeof speedCue?.value === "number" ? speedCue.value : performance.charactersPerSecond;
  const pause = performance.cues.find((cue) => cue.type === "pause" && cue.start === position);
  return Math.max(16, Math.round(1000 / Math.max(1, speed))) + (typeof pause?.value === "number" ? pause.value : 0);
}

function useTypewriter(text: string, performance: TextPerformance) {
  const [progress, setProgress] = useState({ text, count: 0 });
  useEffect(() => {
    setProgress({ text, count: 0 });
    if (!text) return;
    let timeout = 0;
    const tick = (position: number) => {
      if (position >= text.length) return;
      const instant = performance.cues.find((cue) => cue.type === "instant" && cue.start === position);
      const next = instant ? Math.max(position + 1, instant.end) : position + 1;
      timeout = window.setTimeout(() => {
        setProgress({ text, count: next });
        tick(next);
      }, delayForPosition(performance, position));
    };
    tick(0);
    return () => window.clearTimeout(timeout);
  }, [text, performance]);
  const count = progress.text === text ? progress.count : 0;
  return { count, visibleText: text.slice(0, count), complete: count >= text.length, completeImmediately: () => setProgress({ text, count: text.length }) };
}

export default function App() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [playState, setPlayState] = useState<PlayState | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "retrying" | "ready">("connecting");
  const [command, setCommand] = useState("");
  const [requestingKey, setRequestingKey] = useState(false);
  const [authorToken, setAuthorToken] = useState(() => sessionStorage.getItem(AUTHOR_TOKEN_KEY) ?? "");
  const [authorMode, setAuthorMode] = useState(false);
  const [authorMessage, setAuthorMessage] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [activeText, setActiveText] = useState("");
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>();
  const [activePerformance, setActivePerformance] = useState<TextPerformance>({ charactersPerSecond: 18, cues: [] });
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [unhandledCommand, setUnhandledCommand] = useState("");
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string }>>([]);
  const [eventArt, setEventArt] = useState("");
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalHistoryRef = useRef<HTMLDivElement>(null);
  const historyPinnedToPresentRef = useRef(true);
  const firedCueIds = useRef(new Set<string>());
  const flushingQueue = useRef(false);
  const typewriter = useTypewriter(activeText, activePerformance);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      root.style.setProperty("--terminal-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      root.style.removeProperty("--terminal-viewport-height");
    };
  }, []);

  const currentNode = snapshot && playState
    ? snapshot.nodes.find((node) => node.id === playState.currentNodeId) ?? null
    : null;
  const graph = useMemo(() => snapshot ? buildGraphIndex(snapshot) : null, [snapshot]);
  const currentNotation = snapshot && playState && graph
    ? notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, playState.currentNodeId)
    : [];

  const scrollHistoryToPresent = () => {
    const history = terminalHistoryRef.current;
    if (!history) return;
    historyPinnedToPresentRef.current = true;
    history.scrollTop = history.scrollHeight;
  };

  const handleHistoryScroll = () => {
    const history = terminalHistoryRef.current;
    if (!history) return;
    const distanceFromPresent = history.scrollHeight - history.clientHeight - history.scrollTop;
    historyPinnedToPresentRef.current = distanceFromPresent <= 24;
  };

  useLayoutEffect(() => {
    if (!historyPinnedToPresentRef.current) return;
    const frame = window.requestAnimationFrame(scrollHistoryToPresent);
    return () => window.cancelAnimationFrame(frame);
  }, [transcript.length, typewriter.visibleText]);

  const showNode = (project: ProjectSnapshot, node: GameNode, state: PlayState) => {
    firedCueIds.current = new Set();
    setActiveText(interpolateText(node.text, { snapshot: project, state }));
    setActiveNodeId(node.id);
    setActivePerformance(node.performance);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      const cached = await loadCachedSnapshot();
      if (cached && !cancelled) {
        setConnectionState("ready");
        const state = createEmptyPlayState(cached);
        setSnapshot(cached);
        setPlayState(state);
        const node = cached.nodes.find((item) => item.id === cached.startNodeId);
        if (node) showNode(cached, node, state);
      }
      try {
        const project = await waitForProjectSnapshot({
          signal: controller.signal,
          onAttemptFailure: () => {
            if (!cached && !cancelled) setConnectionState("retrying");
          },
        });
        if (cancelled) return;
        setConnectionState("ready");
        setSnapshot(project);
        setPlayState((existing) => {
          const state = existing && project.nodes.some((node) => node.id === existing.currentNodeId)
            ? reconcilePlayState(project, existing)
            : createEmptyPlayState(project);
          const node = project.nodes.find((item) => item.id === state.currentNodeId);
          if (node) showNode(project, node, state);
          return state;
        });
        await saveCachedSnapshot(project);
      } catch (error) {
        if (!cached && !cancelled && (!(error instanceof Error) || error.name !== "AbortError")) {
          setConnectionState("retrying");
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const clearAuthorSession = () => {
    sessionStorage.removeItem(AUTHOR_TOKEN_KEY);
    setAuthorToken("");
    setAuthorMode(false);
    setPanel(null);
  };

  useEffect(() => {
    if (!authorToken) return;
    let cancelled = false;
    void fetch(apiUrl("/api/author/check"), { method: "POST", headers: { Authorization: `Bearer ${authorToken}` } })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) { clearAuthorSession(); return; }
        setAuthorMode(true);
        if (flushingQueue.current) return;
        flushingQueue.current = true;
        const queued = await listQueuedMutations();
        try {
          let project = await fetchProjectSnapshot();
          for (const entry of queued.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))) {
            const result = await submitProjectMutation(authorToken, { ...entry.mutation, expectedRevision: project.revision });
            project = result.snapshot;
            await removeQueuedMutation(entry.id);
          }
          if (queued.length) {
            setSnapshot(project);
            setPlayState((existing) => existing ? reconcilePlayState(project, existing) : createEmptyPlayState(project));
            await saveCachedSnapshot(project);
          }
        } finally {
          flushingQueue.current = false;
        }
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [authorToken]);

  const persist = async (operations: MutationOperation[], description: string) => {
    if (!snapshot || !authorToken) return;
    const before = snapshot;
    const beforeState = playState;
    const optimistic = applyOperations(snapshot, operations);
    const optimisticState = playState ? reconcilePlayState(optimistic, playState) : null;
    const mutation: ProjectMutation = { expectedRevision: snapshot.revision, description, operations };
    setSnapshot(optimistic);
    if (optimisticState) setPlayState(optimisticState);
    await saveCachedSnapshot(optimistic);
    const queueId = await queueMutation(mutation);
    setAuthorMessage("SAVING...");
    try {
      const result = await submitProjectMutation(authorToken, mutation);
      await removeQueuedMutation(queueId);
      setSnapshot(result.snapshot);
      const savedState = optimisticState ? reconcilePlayState(result.snapshot, optimisticState) : null;
      if (savedState) setPlayState(savedState);
      await saveCachedSnapshot(result.snapshot);
      const changedCurrentNode = operations.some((operation) =>
        operation.type === "node.upsert" && operation.node.id === playState?.currentNodeId,
      );
      if (changedCurrentNode && savedState) {
        const changed = result.snapshot.nodes.find((node) => node.id === savedState.currentNodeId);
        if (changed) showNode(result.snapshot, changed, savedState);
      }
      setPanel(null);
      setAuthorMessage(`SAVED R${result.snapshot.revision}.`);
    } catch (error) {
      const conflict = error instanceof Error && error.message.includes("another device");
      if (conflict) {
        await removeQueuedMutation(queueId);
        setSnapshot(before);
        if (beforeState) setPlayState(beforeState);
        const fresh = await fetchProjectSnapshot().catch(() => null);
        if (fresh) {
          setSnapshot(fresh);
          if (beforeState) setPlayState(reconcilePlayState(fresh, beforeState));
          await saveCachedSnapshot(fresh);
        }
        setAuthorMessage("NEWER REVISION FOUND. SYNCHRONIZED; REVIEW AND SAVE AGAIN.");
      } else {
        setSnapshot(optimistic);
        await saveCachedSnapshot(optimistic);
        setPanel(null);
        setAuthorMessage("SAVED LOCALLY; D1 SYNC QUEUED.");
      }
    }
  };

  const downloadBackup = async () => {
    if (!authorToken) return;
    setAuthorMessage("BACKING UP...");
    try {
      const response = await fetch(apiUrl("/api/author/backup"), { headers: { Authorization: `Bearer ${authorToken}` } });
      if (response.status === 401) { clearAuthorSession(); setAuthorMessage("AUTHOR SESSION EXPIRED."); return; }
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `pre-programmed-backup-${Date.now()}.json`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
      setAuthorMessage("BACKUP DOWNLOADED.");
    } catch { setAuthorMessage("BACKUP FAILED."); }
  };

  const appendActive = () => {
    if (!activeText) return;
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: activeText, nodeId: activeNodeId }]);
  };

  const handleEffectEvents = (events: EffectEvent[]) => {
    for (const event of events) {
      if (event.type === "notification") {
        const id = crypto.randomUUID();
        setNotifications((items) => [...items, { id, text: event.text }]);
        window.setTimeout(() => setNotifications((items) => items.filter((item) => item.id !== id)), 1800);
      } else if (event.type === "synth" && snapshot) {
        const sound = snapshot.synthSounds.find((candidate) => candidate.id === event.synthId);
        if (sound) void playSynthSound(sound);
      } else if (event.type === "audio") {
        void new Audio(assetUrl(event.assetPath)).play().catch(() => undefined);
      } else if (event.type === "art") {
        setEventArt(assetUrl(event.assetPath));
      }
    }
  };

  useEffect(() => {
    for (const cue of activePerformance.cues) {
      if (cue.start > typewriter.count || firedCueIds.current.has(cue.id)) continue;
      if (cue.type === "synth" && typeof cue.value === "string") handleEffectEvents([{ type: "synth", synthId: cue.value }]);
      if (cue.type === "audio" && typeof cue.value === "string") handleEffectEvents([{ type: "audio", assetPath: cue.value }]);
      if (cue.type === "sprite" && typeof cue.value === "string") handleEffectEvents([{ type: "art", assetPath: cue.value }]);
      firedCueIds.current.add(cue.id);
    }
  }, [typewriter.count, activePerformance]);

  const handleTerminalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !playState) return;
    historyPinnedToPresentRef.current = true;
    scrollHistoryToPresent();
    const value = command;
    const normalized = value.trim().toLowerCase();
    setCommand(""); setAuthorMessage(""); setUnhandledCommand("");

    if (requestingKey) {
      try {
        const result = await readJson<{ token: string }>(await fetch(apiUrl("/api/author/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: value }) }));
        sessionStorage.setItem(AUTHOR_TOKEN_KEY, result.token); setAuthorToken(result.token); setAuthorMode(true); setRequestingKey(false); setAuthorMessage("AUTHOR MODE.");
      } catch (error) { setAuthorMessage(authorLoginErrorMessage(error)); }
      return;
    }
    if (!value.trim()) return;
    if (normalized === "admin") { authorMode ? setAuthorMessage("AUTHOR MODE.") : setRequestingKey(true); return; }
    if (normalized === "logout" && authorMode) { clearAuthorSession(); return; }
    if (authorMode && (normalized === "backup" || normalized === "/backup")) { await downloadBackup(); return; }
    if (normalized === "inventory" || normalized === "inv") { setInventoryOpen(true); return; }
    if (authorMode && ["/structure", "structure"].includes(normalized)) { setPanel({ type: "structure" }); return; }
    if (authorMode && ["/definitions", "definitions"].includes(normalized)) { setPanel({ type: "definitions" }); return; }
    if (authorMode && ["/assets", "assets"].includes(normalized)) { setPanel({ type: "assets" }); return; }
    if (authorMode && ["/sounds", "sounds"].includes(normalized)) { setPanel({ type: "synth" }); return; }
    if (authorMode && ["/history", "/locations", "/bookmark", "history", "locations"].includes(normalized)) { setPanel({ type: "workspace" }); return; }

    const commandState = { ...playState, commandsEntered: playState.commandsEntered + 1, lastCommand: value };
    const parsed = parseCommand(value, snapshot, commandState);
    setParserResult(parsed);
    appendActive();
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: `${UNIVERSE_DRIVE_PROMPT}${value}`, command: true }]);
    if (!parsed.interaction) {
      setPlayState(commandState);
      setActiveText(""); setActiveNodeId(undefined);
      if (authorMode) { setUnhandledCommand(value); setAuthorMessage(`UNHANDLED: ${parsed.reason}.`); }
      return;
    }
    const execution = executeInteraction(snapshot, commandState, parsed.interaction);
    setPlayState(execution.state);
    handleEffectEvents(execution.events);
    const destination = snapshot.nodes.find((node) => node.id === execution.state.currentNodeId);
    if (execution.responseText) setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: execution.responseText }]);
    if (execution.state.traversal.length > commandState.traversal.length && destination) showNode(snapshot, destination, execution.state);
    else { setActiveText(""); setActiveNodeId(undefined); }
  };

  const focusTerminal = () => { if (!panel && !inventoryOpen) terminalInputRef.current?.focus(); };
  const restoreBookmark = (bookmark: AuthorBookmark) => {
    if (!snapshot) return;
    const state = reconcilePlayState(snapshot, bookmark.playState);
    setPlayState(state);
    const node = snapshot?.nodes.find((candidate) => candidate.id === bookmark.nodeId);
    if (node) showNode(snapshot, node, state);
    setPanel(null); setAuthorMessage("LOCATION RESTORED.");
  };
  const applyInventoryState = (state: PlayState) => {
    if (!snapshot || !playState) return;
    const transitioned = state.traversal.length > playState.traversal.length;
    setPlayState(state);
    if (!transitioned) return;
    const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
    if (node) showNode(snapshot, node, state);
    setInventoryOpen(false);
  };
  const applyCanonicalSnapshot = (project: ProjectSnapshot) => {
    if (!playState) return;
    const state = project.nodes.some((node) => node.id === playState.currentNodeId)
      ? reconcilePlayState(project, playState)
      : createEmptyPlayState(project);
    setSnapshot(project);
    setPlayState(state);
    const node = project.nodes.find((candidate) => candidate.id === state.currentNodeId);
    if (node) showNode(project, node, state);
    void saveCachedSnapshot(project);
  };

  if (!snapshot || !playState || !currentNode) return <main className="dos-screen" aria-label="Pre-Programmed terminal"><div className="dos-terminal">{connectionState === "retrying" ? "SYSTEM LINK: WAITING FOR API..." : "CONNECTING TO UNIVERSE..."}</div></main>;
  const promptLabel = requestingKey ? "ADMIN KEY>" : UNIVERSE_DRIVE_PROMPT;
  const mirroredCommand = requestingKey ? "*".repeat(command.length) : command;
  const workSurfaceOpen = Boolean(panel || inventoryOpen);

  return <main className="dos-screen" aria-label="Pre-Programmed terminal" onPointerDown={() => {
    if (!typewriter.complete) { typewriter.completeImmediately(); return; }
    focusTerminal();
  }}>
    <div className="dos-terminal">
      <div
        ref={terminalHistoryRef}
        className="terminal-history"
        aria-live="polite"
        onScroll={handleHistoryScroll}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!typewriter.complete) typewriter.completeImmediately();
        }}
      >
        <div className="terminal-history-content">
          {transcript.map((line) => authorMode && line.nodeId ? <button type="button" className="story-edit-target transcript-node" key={line.id} onClick={(event) => { event.stopPropagation(); const node = snapshot.nodes.find((candidate) => candidate.id === line.nodeId); if (node) setPanel({ type: "node", node }); }}>{line.text}</button> : <div className={line.command ? "command-line" : "story-line"} key={line.id}>{line.text}</div>)}
          {activeText ? authorMode && typewriter.complete && activeNodeId ? <button type="button" className="story-edit-target" onClick={(event) => { event.stopPropagation(); const node = snapshot.nodes.find((candidate) => candidate.id === activeNodeId); if (node) setPanel({ type: "node", node }); }}><RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} /></button> : <div className="story-line"><RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} /></div> : null}
        </div>
      </div>

      {typewriter.complete && !panel && !inventoryOpen ? <form className="prompt-line" onSubmit={(event) => void handleTerminalSubmit(event)}><span>{promptLabel}</span><span>{mirroredCommand}</span><span className="dos-cursor" aria-hidden="true" /><input ref={terminalInputRef} className="terminal-input" type={requestingKey ? "password" : "text"} value={command} onChange={(event) => setCommand(event.target.value)} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} autoFocus enterKeyHint="send" aria-label={requestingKey ? "Author key" : "Universe command"} /></form> : null}

      <div className={`terminal-lower${workSurfaceOpen ? " terminal-lower-expanded" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
        {authorMode && typewriter.complete ? <div className="author-context"><div className="author-status"><span>[AUTHOR] #{currentNode.nodeNumber} R{snapshot.revision} {currentNotation.join("")}</span>{parserResult ? <span>MATCH: {parserResult.reason}{parserResult.matchedAlias ? ` / ${parserResult.matchedAlias}` : ""}</span> : null}</div><div className="author-toolbar"><button type="button" onClick={() => setPanel({ type: "node", node: currentNode })}>[EDIT NODE]</button><button type="button" onClick={() => setPanel({ type: "interaction" })}>[+ RESPONSE]</button><button type="button" onClick={() => setPanel({ type: "structure" })}>[STRUCTURE]</button><button type="button" onClick={() => setPanel({ type: "definitions" })}>[DEFINITIONS]</button><button type="button" onClick={() => setInventoryOpen(true)}>[INVENTORY]</button><button type="button" onClick={() => setPanel({ type: "assets" })}>[ASSETS]</button><button type="button" onClick={() => setPanel({ type: "synth" })}>[SOUND]</button><button type="button" onClick={() => setPanel({ type: "workspace" })}>[HISTORY]</button></div></div> : null}
        {unhandledCommand && authorMode && !panel ? <div className="unhandled-tools"><span>TURN “{unhandledCommand}” INTO:</span><button type="button" onClick={() => setPanel({ type: "interaction", command: unhandledCommand })}>[NEW STAY / TRANSITION]</button><div className="alias-strip"><span>ALIAS:</span>{snapshot.interactions.filter((interaction) => interaction.sourceNodeId === playState.currentNodeId).map((interaction) => <button type="button" key={interaction.id} onClick={() => setPanel({ type: "interaction", interaction: { ...structuredClone(interaction), aliases: [...interaction.aliases, unhandledCommand] } })}>[{interaction.wording || interaction.aliases[0]}]</button>)}{!snapshot.interactions.some((interaction) => interaction.sourceNodeId === playState.currentNodeId) ? <span>no current interactions</span> : null}</div></div> : null}
        {authorMessage ? <div className="author-message">{authorMessage}</div> : null}

        {inventoryOpen ? <Inventory snapshot={snapshot} state={playState} authorMode={authorMode} onState={applyInventoryState} onOutput={(text) => setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text }])} onEvents={handleEffectEvents} onEditItem={(item) => { setInventoryOpen(false); setPanel({ type: "item", item }); }} onCreateItem={() => { setInventoryOpen(false); setPanel({ type: "item" }); }} onClose={() => setInventoryOpen(false)} /> : null}
        {panel?.type === "node" ? <NodeEditor node={panel.node} snapshot={snapshot} onSave={persist} onCancel={() => setPanel(null)} /> : null}
        {panel?.type === "interaction" ? <InteractionEditor snapshot={snapshot} playState={playState} initial={panel.interaction} initialCommand={panel.command} onSave={persist} onCancel={() => setPanel(null)} /> : null}
        {panel?.type === "definitions" ? <DefinitionsPanel snapshot={snapshot} onSave={persist} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "structure" ? <StructureNavigator snapshot={snapshot} playState={playState} onOpenNode={(nodeId) => { const node = snapshot.nodes.find((candidate) => candidate.id === nodeId); if (node) setPanel({ type: "node", node }); }} onEditInteraction={(interaction) => setPanel({ type: "interaction", interaction })} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "assets" ? <AssetExplorer snapshot={snapshot} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "synth" ? <SynthPanel snapshot={snapshot} onSave={persist} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "workspace" ? <WorkspacePanel token={authorToken} snapshot={snapshot} playState={playState} onSave={persist} onSnapshot={applyCanonicalSnapshot} onRestore={restoreBookmark} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "item" ? <ItemEditor snapshot={snapshot} initial={panel.item} onSave={persist} onCancel={() => setPanel(null)} /> : null}
      </div>
    </div>
    <div className="floating-notifications" aria-live="polite">{notifications.map((item) => <div key={item.id}>{item.text}</div>)}</div>
    {eventArt ? <div className="event-art" onPointerDown={(event) => event.stopPropagation()}><img src={eventArt} alt="" /><button type="button" onClick={() => setEventArt("")}>[CLOSE]</button></div> : null}
  </main>;
}

function RenderedPerformanceText({ text, performance }: { text: string; performance: TextPerformance }) {
  const segments: Array<{ text: string; classes: string[] }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const classes = performance.cues
      .filter((cue) => ["wave", "shake", "blink"].includes(cue.type) && cue.start <= index && cue.end > index)
      .map((cue) => `cue-${cue.type}`);
    const previous = segments.at(-1);
    if (previous && previous.classes.join(" ") === classes.join(" ")) previous.text += text[index];
    else segments.push({ text: text[index], classes });
  }
  return <>{segments.map((segment, index) => <span key={index} className={segment.classes.join(" ")}>{segment.text}</span>)}</>;
}
