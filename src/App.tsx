import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AssetExplorer, SynthPanel, WorkspacePanel } from "./components/AuthorTools";
import { AuthorSettings } from "./components/AuthorSettings";
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
import { addNewDefaultItemsToPlayState } from "./game/inventory";
import { interpolateText } from "./game/interpolation";
import { applyOperations } from "./game/mutations";
import {
  createEmptyPlayState,
  reconcilePlayState,
  resumeAuthorBookmark,
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
import { advanceTimedVariables, timedVariableKey } from "./game/timedVariables";
import { isSoftwareKeyboardOpen } from "./ui/viewport";
import { UNIVERSE_DRIVE_PROMPT } from "./game/opening";

const AUTHOR_TOKEN_KEY = "pre-programmed:author-token";

type TranscriptLine = { id: string; text: string; nodeId?: string; command?: boolean };
type Panel =
  | { type: "node"; node: GameNode }
  | { type: "interaction"; interaction?: Interaction; command?: string; fallback?: boolean }
  | { type: "definitions" }
  | { type: "structure" }
  | { type: "assets" }
  | { type: "synth" }
  | { type: "workspace"; view?: "locations" | "history" }
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
  const performanceKey = JSON.stringify(performance);
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
  }, [text, performanceKey]);
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
  const [authorView, setAuthorView] = useState(true);
  const [authorMessage, setAuthorMessage] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [activeText, setActiveText] = useState("");
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>();
  const [activePerformance, setActivePerformance] = useState<TextPerformance>({ charactersPerSecond: 18, cues: [] });
  const [pendingDestinationNodeId, setPendingDestinationNodeId] = useState<string | null>(null);
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [unhandledCommand, setUnhandledCommand] = useState("");
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; anchorLineId?: string }>>([]);
  const [choiceMenuOpen, setChoiceMenuOpen] = useState(false);
  const [eventArt, setEventArt] = useState("");
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const promptFormRef = useRef<HTMLFormElement>(null);
  const terminalHistoryRef = useRef<HTMLDivElement>(null);
  const historyPinnedToPresentRef = useRef(true);
  const firedCueIds = useRef(new Set<string>());
  const completedPendingDestination = useRef("");
  const flushingQueue = useRef(false);
  const typewriter = useTypewriter(activeText, activePerformance);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let maximumViewportHeight = viewport?.height ?? window.innerHeight;
    let viewportWidth = viewport?.width ?? window.innerWidth;
    let focusFrame = 0;
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const width = viewport?.width ?? window.innerWidth;
      if (Math.abs(width - viewportWidth) > 80) {
        maximumViewportHeight = height;
        viewportWidth = width;
      } else {
        maximumViewportHeight = Math.max(maximumViewportHeight, height);
      }
      const active = document.activeElement;
      const editableFocused = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      root.style.setProperty("--terminal-viewport-height", `${height}px`);
      root.style.setProperty("--terminal-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      root.dataset.keyboardOpen = String(isSoftwareKeyboardOpen({
        viewportHeight: height,
        maximumViewportHeight,
        viewportWidth: width,
        editableFocused,
      }));
    };
    const syncViewportAfterFocus = () => {
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(syncViewport);
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    document.addEventListener("focusin", syncViewportAfterFocus);
    document.addEventListener("focusout", syncViewportAfterFocus);
    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      document.removeEventListener("focusin", syncViewportAfterFocus);
      document.removeEventListener("focusout", syncViewportAfterFocus);
      window.cancelAnimationFrame(focusFrame);
      root.style.removeProperty("--terminal-viewport-height");
      root.style.removeProperty("--terminal-viewport-top");
      delete root.dataset.keyboardOpen;
    };
  }, []);

  const currentNode = snapshot && playState
    ? snapshot.nodes.find((node) => node.id === playState.currentNodeId) ?? null
    : null;
  const graph = useMemo(() => snapshot ? buildGraphIndex(snapshot) : null, [snapshot]);
  const currentNotation = snapshot && playState && graph
    ? notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, playState.currentNodeId)
    : [];
  const currentInputs = snapshot && playState
    ? snapshot.interactions.filter((interaction) => interaction.sourceNodeId === playState.currentNodeId && (interaction.matchMode ?? "command") === "command")
    : [];
  const fallbackInput = snapshot && playState
    ? snapshot.interactions.find((interaction) => interaction.sourceNodeId === playState.currentNodeId && interaction.matchMode === "fallback")
    : undefined;
  const playerChoiceInputs = playState
    ? currentInputs.filter((interaction) => playState.interactionVisibility[interaction.id] !== false)
    : [];
  const immediateChoices = playerChoiceInputs.filter((interaction) => interaction.choiceVisibility === "immediate");
  const promptChoices = playerChoiceInputs.filter((interaction) => (interaction.choiceVisibility ?? "prompt") === "prompt");
  const timedVariables = snapshot ? timedVariableKey(snapshot) : "[]";

  useEffect(() => {
    if (!snapshot) return;
    const now = Date.now();
    setPlayState((state) => state ? { ...state, variableTimeUpdatedAt: now } : state);
    if (timedVariables === "[]") return;
    const timer = window.setInterval(() => {
      setPlayState((state) => state ? advanceTimedVariables(snapshot, state, Date.now()) : state);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timedVariables]);

  const notationForInput = (interaction: Interaction) => {
    if (interaction.outcomes.some((outcome) => (outcome.authorStatus ?? "configured") === "draft")) return "[D]";
    const first = [...interaction.outcomes].sort((left, right) => left.order - right.order)[0];
    if (!first) return "[D]";
    if (first.disposition === "stay" || !first.destinationNodeId) return "[H]";
    if (!snapshot || !playState || !graph) return "[A1]";
    return notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, first.destinationNodeId).join("") || "[A1]";
  };

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
    if (!typewriter.complete || !pendingDestinationNodeId || !snapshot || !playState || !activeText) return;
    const completionKey = `${pendingDestinationNodeId}:${activeText}`;
    if (completedPendingDestination.current === completionKey) return;
    completedPendingDestination.current = completionKey;
    const destination = snapshot.nodes.find((node) => node.id === pendingDestinationNodeId);
    setPendingDestinationNodeId(null);
    if (!destination) return;
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: activeText }]);
    showNode(snapshot, destination, playState);
  }, [typewriter.complete, pendingDestinationNodeId, snapshot, playState, activeText]);

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
    setAuthorView(true);
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
        setAuthorView(true);
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
    const optimisticState = playState
      ? addNewDefaultItemsToPlayState(snapshot, optimistic, reconcilePlayState(optimistic, playState))
      : null;
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

  const handleEffectEvents = (events: EffectEvent[], anchorLineId?: string) => {
    for (const event of events) {
      if (event.type === "notification") {
        const id = crypto.randomUUID();
        setNotifications((items) => [...items, { id, text: event.text, anchorLineId }]);
        window.setTimeout(() => setNotifications((items) => items.filter((item) => item.id !== id)), 4000);
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

  const handleTerminalValue = async (value: string) => {
    if (!snapshot || !playState) return;
    historyPinnedToPresentRef.current = true;
    scrollHistoryToPresent();
    const normalized = value.trim().toLowerCase();
    setCommand(""); setAuthorMessage(""); setUnhandledCommand(""); setChoiceMenuOpen(false);

    if (requestingKey) {
      try {
        const result = await readJson<{ token: string }>(await fetch(apiUrl("/api/author/login"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: value }) }));
        sessionStorage.setItem(AUTHOR_TOKEN_KEY, result.token); setAuthorToken(result.token); setAuthorMode(true); setAuthorView(true); setRequestingKey(false); setAuthorMessage("");
      } catch (error) { setAuthorMessage(authorLoginErrorMessage(error)); }
      return;
    }
    if (!value.trim()) return;
    if (normalized === "admin") { if (authorMode) { setAuthorView(true); setAuthorMessage(""); } else setRequestingKey(true); return; }
    if (normalized === "logout" && authorMode) { clearAuthorSession(); return; }
    if (authorMode && authorView && (normalized === "backup" || normalized === "/backup")) { await downloadBackup(); return; }
    if (normalized === "inventory" || normalized === "inv") { setInventoryOpen(true); return; }
    if (authorMode && authorView && ["/structure", "structure"].includes(normalized)) { setPanel({ type: "structure" }); return; }
    if (authorMode && authorView && ["/definitions", "definitions"].includes(normalized)) { setPanel({ type: "definitions" }); return; }
    if (authorMode && authorView && ["/assets", "assets"].includes(normalized)) { setPanel({ type: "assets" }); return; }
    if (authorMode && authorView && ["/sounds", "sounds"].includes(normalized)) { setPanel({ type: "synth" }); return; }
    if (authorMode && authorView && ["/locations", "/bookmark", "locations"].includes(normalized)) { setPanel({ type: "workspace", view: "locations" }); return; }
    if (authorMode && authorView && ["/history", "history"].includes(normalized)) { setPanel({ type: "workspace", view: "history" }); return; }

    const currentState = advanceTimedVariables(snapshot, playState, Date.now());
    const commandState = { ...currentState, commandsEntered: currentState.commandsEntered + 1, lastCommand: value };
    const parsed = parseCommand(value, snapshot, commandState);
    setParserResult(parsed);
    appendActive();
    const commandLineId = crypto.randomUUID();
    setTranscript((lines) => [...lines, { id: commandLineId, text: `${UNIVERSE_DRIVE_PROMPT}${value}`, command: true }]);
    if (!parsed.interaction) {
      setPlayState(commandState);
      setActiveText(""); setActiveNodeId(undefined);
      if (authorMode && authorView) { setUnhandledCommand(value); setAuthorMessage(`UNHANDLED: ${parsed.reason}.`); }
      return;
    }
    const execution = executeInteraction(snapshot, commandState, parsed.interaction);
    setPlayState(execution.state);
    handleEffectEvents(execution.events, commandLineId);
    const transitioned = execution.state.traversal.length > commandState.traversal.length;
    const destination = transitioned
      ? snapshot.nodes.find((node) => node.id === execution.state.currentNodeId)
      : undefined;
    if (execution.responseText) {
      firedCueIds.current = new Set();
      completedPendingDestination.current = "";
      setActiveText(execution.responseText);
      setActiveNodeId(undefined);
      setActivePerformance({ charactersPerSecond: execution.outcome?.responseCharactersPerSecond ?? 18, cues: [] });
      setPendingDestinationNodeId(destination?.id ?? null);
    } else if (destination) {
      setPendingDestinationNodeId(null);
      showNode(snapshot, destination, execution.state);
    } else {
      setPendingDestinationNodeId(null);
      setActiveText("");
      setActiveNodeId(undefined);
    }
  };

  const handleTerminalSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleTerminalValue(command);
  };

  const choosePlayerInput = (interaction: Interaction) => {
    const value = interaction.aliases[0] || interaction.wording;
    if (value) void handleTerminalValue(value);
  };

  const focusTerminal = () => { if (!panel && !inventoryOpen) terminalInputRef.current?.focus(); };
  const restoreBookmark = (bookmark: AuthorBookmark) => {
    if (!snapshot) return;
    const state = resumeAuthorBookmark(snapshot, bookmark);
    setPlayState(state);
    const node = snapshot?.nodes.find((candidate) => candidate.id === bookmark.nodeId);
    if (node) showNode(snapshot, node, state);
    setPanel(null); setAuthorMessage("LOCATION LOADED.");
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
  const showInventoryResponse = (text: string) => {
    appendActive();
    setActiveText("");
    setActiveNodeId(undefined);
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text }]);
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
  const dialogueAuthoring = panel?.type === "interaction";
  const workSurfaceOpen = Boolean((panel && !dialogueAuthoring) || inventoryOpen);
  const editorOpen = Boolean(panel || inventoryOpen);
  const authorExperience = authorMode && authorView;
  const closeEditor = () => { setPanel(null); setInventoryOpen(false); };

  return <main className="dos-screen" aria-label="Pre-Programmed terminal" onPointerDown={() => {
    if (!typewriter.complete) { typewriter.completeImmediately(); return; }
    focusTerminal();
  }}>
    <div className={`dos-terminal${dialogueAuthoring ? " dialogue-authoring-active" : ""}`}>
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
          {transcript.map((line) => {
            if (authorExperience && line.nodeId) return <button type="button" className="story-edit-target transcript-node" key={line.id} onClick={(event) => { event.stopPropagation(); const node = snapshot.nodes.find((candidate) => candidate.id === line.nodeId); if (node) setPanel({ type: "node", node }); }}>{line.text}</button>;
            const anchoredNotifications = notifications.filter((item) => item.anchorLineId === line.id);
            return <div className={line.command ? "command-line" : "story-line"} key={line.id}>{line.text}{anchoredNotifications.length ? <span className="inline-floating-notifications" aria-live="polite">{anchoredNotifications.map((item) => <span key={item.id}>{item.text}</span>)}</span> : null}</div>;
          })}
          {activeText ? authorExperience && typewriter.complete && activeNodeId ? <button type="button" className="story-edit-target" onClick={(event) => { event.stopPropagation(); const node = snapshot.nodes.find((candidate) => candidate.id === activeNodeId); if (node) setPanel({ type: "node", node }); }}><RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} /></button> : <div className="story-line"><RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} /></div> : null}
        </div>
      </div>

      {typewriter.complete && dialogueAuthoring ? <div className="prompt-line prompt-line-paused" aria-hidden="true"><span>{UNIVERSE_DRIVE_PROMPT}</span><span className="dos-cursor" /></div> : null}
      {typewriter.complete && !pendingDestinationNodeId && !panel && !inventoryOpen ? <form
        ref={promptFormRef}
        className="prompt-line"
        onSubmit={handleTerminalSubmit}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!requestingKey && !command && promptChoices.length) setChoiceMenuOpen((value) => !value);
        }}
        aria-expanded={!requestingKey && choiceMenuOpen}
      ><span>{promptLabel}</span><span>{mirroredCommand}</span><span className="dos-cursor" aria-hidden="true" /><input ref={terminalInputRef} className="terminal-input" type={requestingKey ? "password" : "text"} value={command} onChange={(event) => { setCommand(event.target.value); if (event.target.value) setChoiceMenuOpen(false); }} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} autoFocus enterKeyHint="send" aria-label={requestingKey ? "Author key" : "Universe command"} /></form> : null}

      <div className={`terminal-lower${workSurfaceOpen ? " terminal-lower-expanded" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
        {typewriter.complete && !pendingDestinationNodeId && !requestingKey && !command && (immediateChoices.length || (choiceMenuOpen && promptChoices.length)) && !panel && !inventoryOpen ? <PlayerChoiceSurface
          choices={[...immediateChoices, ...(choiceMenuOpen ? promptChoices : [])]}
          onChoose={choosePlayerInput}
        /> : null}

        {dialogueAuthoring ? <div className="dialogue-authoring-popover">
          {panel?.type === "interaction" ? <InteractionEditor snapshot={snapshot} playState={playState} initial={panel.interaction} initialCommand={panel.command} fallback={panel.fallback} onSave={persist} onCancel={() => setPanel(null)} /> : null}
        </div> : null}

        {authorExperience && typewriter.complete && !pendingDestinationNodeId && !dialogueAuthoring && !panel && !inventoryOpen ? <div className="author-context">
          <div className="author-status"><span>[AUTHOR] #{currentNode.nodeNumber} R{snapshot.revision} {currentNotation.join("")}</span>{parserResult ? <span>MATCH: {parserResult.reason}{parserResult.matchedAlias ? ` / ${parserResult.matchedAlias}` : ""}</span> : null}</div>
          <div className="author-primary-actions"><button type="button" onClick={() => setPanel({ type: "node", node: currentNode })}>[EDIT NODE-TEXT]</button><button type="button" onClick={() => setPanel({ type: "interaction" })}>[+ USER-INPUT-TEXT]</button><button type="button" className={fallbackInput && notationForInput(fallbackInput) === "[D]" ? "draft-input" : ""} onClick={() => setPanel({ type: "interaction", interaction: fallbackInput, fallback: true })}>{fallbackInput ? `${notationForInput(fallbackInput)} INVALID INPUT` : "[+ INVALID INPUT]"}</button></div>
          <div className="current-inputs">
            <span>USER INPUTS FROM HERE</span>
            <div>{currentInputs.map((interaction) => <button type="button" className={notationForInput(interaction) === "[D]" ? "draft-input" : ""} key={interaction.id} onClick={() => setPanel({ type: "interaction", interaction })}><strong>{notationForInput(interaction)}</strong> {interaction.wording || interaction.aliases[0] || "untitled"}</button>)}{!currentInputs.length ? <span className="muted">none yet</span> : null}</div>
          </div>
          <details className="author-more-tools"><summary>[MORE TOOLS]</summary><div className="author-toolbar"><button type="button" onClick={() => setPanel({ type: "structure" })}>[STRUCTURE]</button><button type="button" onClick={() => setPanel({ type: "definitions" })}>[STATE + PEOPLE]</button><button type="button" onClick={() => setInventoryOpen(true)}>[INVENTORY]</button><button type="button" onClick={() => setPanel({ type: "assets" })}>[ASSETS]</button><button type="button" onClick={() => setPanel({ type: "synth" })}>[SOUND]</button><button type="button" onClick={() => setPanel({ type: "workspace", view: "locations" })}>[LOCATIONS]</button><button type="button" onClick={() => setPanel({ type: "workspace", view: "history" })}>[HISTORY]</button><button type="button" onClick={() => void downloadBackup()}>[BACKUP]</button></div></details>
        </div> : null}
        {unhandledCommand && authorExperience && !panel && !inventoryOpen ? <div className="unhandled-tools">
          <span>USER JUST INPUT: <strong>“{unhandledCommand}”</strong></span><span>NO RESPONSE IS AUTHORED.</span>
          <button type="button" onClick={() => setPanel({ type: "interaction", command: unhandledCommand })}>[WRITE WHAT THEY SEE]</button>
          <details className="alias-strip"><summary>[USE AS AN ALIAS]</summary><div>{currentInputs.map((interaction) => <button type="button" key={interaction.id} onClick={() => setPanel({ type: "interaction", interaction: { ...structuredClone(interaction), aliases: [...interaction.aliases, unhandledCommand] } })}>[{interaction.wording || interaction.aliases[0]}]</button>)}{!currentInputs.length ? <span>no current user inputs</span> : null}</div></details>
        </div> : null}
        {authorMessage && !panel && !inventoryOpen ? <div className="author-message">{authorMessage}</div> : null}

        {inventoryOpen ? <Inventory snapshot={snapshot} state={playState} authorMode={authorExperience} onState={applyInventoryState} onOutput={showInventoryResponse} onEvents={handleEffectEvents} onEditItem={(item) => { setInventoryOpen(false); setPanel({ type: "item", item }); }} onCreateItem={() => { setInventoryOpen(false); setPanel({ type: "item" }); }} onSave={persist} onClose={() => setInventoryOpen(false)} /> : null}
        {panel?.type === "node" ? <NodeEditor node={panel.node} snapshot={snapshot} onSave={persist} onCancel={() => setPanel(null)} /> : null}
        {panel?.type === "definitions" ? <DefinitionsPanel snapshot={snapshot} onSave={persist} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "structure" ? <StructureNavigator snapshot={snapshot} playState={playState} onOpenNode={(nodeId) => { const node = snapshot.nodes.find((candidate) => candidate.id === nodeId); if (node) setPanel({ type: "node", node }); }} onEditInteraction={(interaction) => setPanel({ type: "interaction", interaction })} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "assets" ? <AssetExplorer snapshot={snapshot} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "synth" ? <SynthPanel snapshot={snapshot} onSave={persist} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "workspace" ? <WorkspacePanel token={authorToken} snapshot={snapshot} playState={playState} initialView={panel.view} onSave={persist} onSnapshot={applyCanonicalSnapshot} onRestore={restoreBookmark} onClose={() => setPanel(null)} /> : null}
        {panel?.type === "item" ? <ItemEditor snapshot={snapshot} initial={panel.item} onSave={persist} onCancel={() => setPanel(null)} /> : null}
      </div>
    </div>
    {editorOpen ? <button className="work-surface-close" type="button" aria-label="Close editor" onPointerDown={(event) => event.stopPropagation()} onClick={closeEditor}>[X]</button> : null}
    {authorMode && !editorOpen ? <AuthorSettings authorView={authorView} onToggleAuthorView={() => {
      setAuthorView((value) => !value);
      setPanel(null);
      setUnhandledCommand("");
      setAuthorMessage("");
    }} /> : null}
    <div className="floating-notifications" aria-live="polite">{notifications.filter((item) => !item.anchorLineId).map((item) => <div key={item.id}>{item.text}</div>)}</div>
    {eventArt ? <div className="event-art" onPointerDown={(event) => event.stopPropagation()}><img src={eventArt} alt="" /><button type="button" onClick={() => setEventArt("")}>[CLOSE]</button></div> : null}
  </main>;
}

function PlayerChoiceSurface({ choices, onChoose }: { choices: Interaction[]; onChoose: (interaction: Interaction) => void }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const choiceKey = choices.map((choice) => choice.id).join(":");
  const measure = () => {
    const surface = surfaceRef.current;
    if (!surface) return;
    setHasMoreBelow(surface.scrollTop + surface.clientHeight < surface.scrollHeight - 2);
  };

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [choiceKey]);

  return <div className="player-choice-scroll">
    <div ref={surfaceRef} className="player-choice-surface" aria-label="Available choices" onScroll={measure}>
      {choices.map((interaction) => <button type="button" key={interaction.id} onClick={() => onChoose(interaction)}>{interaction.wording || interaction.aliases[0]}</button>)}
    </div>
    {hasMoreBelow ? <button type="button" className="choice-scroll-cue" aria-label="Show more choices" onClick={() => surfaceRef.current?.scrollBy({ top: Math.max(44, surfaceRef.current.clientHeight * .8), behavior: "auto" })}>↓</button> : null}
  </div>;
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
