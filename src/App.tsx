import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AuthorHome } from "./author/AuthorHome";
import {
  flushQueuedAuthorMutations,
  persistAuthorMutation,
  type AuthorPersistResult,
} from "./author/persistence/authorProjectPersistence";
import { buildAuthorToolGroups } from "./author/tools/registry";
import { AuthorWorkspaceHost } from "./author/workspace/AuthorWorkspaceHost";
import { useWorkSurfaceNavigation, type AuthorPanelRoute } from "./author/workSurfaceNavigation";
import { AuthorSettings, readDisplaySettings } from "./components/AuthorSettings";
import {
  apiUrl,
  authorLoginErrorMessage,
  fetchProjectSnapshot,
  readJson,
  waitForProjectSnapshot,
} from "./data/api";
import {
  loadCachedSnapshot,
  saveCachedSnapshot,
} from "./data/localProject";
import { assetUrl } from "./data/assets";
import {
  advanceProjectClocks,
  hasActiveProjectClock,
  projectClockScheduleKey,
  resetProjectClocks,
} from "./engine/runtime/projectClock";
import { effectEventsForTextCue, presentEffectEvents, type EffectEvent } from "./game/effects";
import { buildGraphIndex, notationForNode } from "./game/graph";
import { interpolateText } from "./game/interpolation";
import { applyOperations } from "./game/mutations";
import {
  createEmptyPlayState,
  reconcilePlayState,
  reconcilePlayStateAfterProjectChange,
  resumeAuthorBookmark,
  type AuthorBookmark,
  type GameNode,
  type Interaction,
  type MutationOperation,
  type PlayState,
  type ProjectMutation,
  type ProjectSnapshot,
  type TextPerformance,
} from "./game/model";
import { executeOperation } from "./game/operations";
import { parseCommand, type ParserResult } from "./game/parser";
import { executeInteraction } from "./game/runtime";
import { compileTextNotation } from "./game/textNotation";
import { APPLICATION_COMMAND_CAPABILITY_BY_OPERATION } from "./features/commands/applicationCatalog";
import { createDraftInteraction } from "./features/narrative/drafts";
import { AuthorInputSurface } from "./features/narrative/author/AuthorInputSurface";
import { cloudflareProjectPersistence } from "./platform/persistence/cloudflareProjectPersistence";
import {
  TerminalCommandComposer,
  type TerminalCommandChoice,
  type TerminalCommandComposerHandle,
} from "./ui/TerminalCommandComposer";
import { useTerminalViewport } from "./ui/useTerminalViewport";

const AUTHOR_TOKEN_KEY = "pre-programmed:author-token";

type TranscriptLine = {
  id: string;
  text: string;
  nodeId?: string;
  speakerId?: string | null;
  command?: boolean;
  artPath?: string;
};

function terminalChoiceForInteraction(interaction: Interaction): TerminalCommandChoice {
  return {
    id: interaction.id,
    text: interaction.aliases[0] || interaction.wording,
  };
}

function delayForPosition(performance: TextPerformance, position: number, speedMultiplier: number) {
  const speedCue = performance.cues.find((cue) => cue.type === "speed" && cue.start <= position && cue.end > position);
  const speed = typeof speedCue?.value === "number" ? speedCue.value : performance.charactersPerSecond;
  const pause = performance.cues.find((cue) => cue.type === "pause" && cue.start === position);
  return Math.max(8, Math.round(1000 / Math.max(1, speed * speedMultiplier))) + (typeof pause?.value === "number" ? pause.value : 0);
}

function useTypewriter(text: string, performance: TextPerformance, speedMultiplier: number) {
  const [progress, setProgress] = useState({ text, count: 0 });
  const performanceKey = JSON.stringify(performance);
  const speedMultiplierRef = useRef(speedMultiplier);
  useEffect(() => { speedMultiplierRef.current = speedMultiplier; }, [speedMultiplier]);
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
      }, delayForPosition(performance, position, speedMultiplierRef.current));
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
  const workSurface = useWorkSurfaceNavigation();
  const panel = workSurface.panel;
  const setPanel = (next: AuthorPanelRoute | null) => next ? workSurface.openPanel(next) : workSurface.close();
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [activeText, setActiveText] = useState("");
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>();
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [activePerformance, setActivePerformance] = useState<TextPerformance>({ charactersPerSecond: 18, cues: [] });
  const [textSpeedMultiplier, setTextSpeedMultiplier] = useState(() => readDisplaySettings().textSpeedMultiplier);
  const [pendingDestinationNodeId, setPendingDestinationNodeId] = useState<string | null>(null);
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [unhandledCommand, setUnhandledCommand] = useState("");
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; anchorLineId?: string }>>([]);
  const [eventArt, setEventArt] = useState("");
  const terminalComposerRef = useRef<TerminalCommandComposerHandle>(null);
  const terminalHistoryRef = useRef<HTMLDivElement>(null);
  const historyPinnedToPresentRef = useRef(true);
  const firedCueIds = useRef(new Set<string>());
  const completedPendingDestination = useRef("");
  const flushingQueue = useRef(false);
  const typewriter = useTypewriter(activeText, activePerformance, textSpeedMultiplier);
  useTerminalViewport();

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
  const immediateTerminalChoices = immediateChoices.map(terminalChoiceForInteraction).filter((choice) => choice.text);
  const promptTerminalChoices = promptChoices.map(terminalChoiceForInteraction).filter((choice) => choice.text);
  const projectClockSchedule = snapshot ? projectClockScheduleKey(snapshot) : "[]";

  useEffect(() => {
    if (!snapshot) return;
    const now = Date.now();
    setPlayState((state) => state ? resetProjectClocks(snapshot, state, now) : state);
    if (!hasActiveProjectClock(snapshot)) return;
    const timer = window.setInterval(() => {
      setPlayState((state) => state ? advanceProjectClocks(snapshot, state, Date.now()) : state);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [projectClockSchedule]);

  useEffect(() => {
    if (!typewriter.complete || pendingDestinationNodeId || panel) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const frame = window.requestAnimationFrame(() => terminalComposerRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [typewriter.complete, pendingDestinationNodeId, panel, requestingKey]);

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
    const compiled = compileTextNotation(interpolateText(node.text, { snapshot: project, state }), node.performance);
    setActiveText(compiled.text);
    setActiveNodeId(node.id);
    setActiveSpeakerId(node.characterId);
    setActivePerformance(compiled.performance);
  };

  useEffect(() => {
    if (!typewriter.complete || !pendingDestinationNodeId || !snapshot || !playState || !activeText) return;
    const completionKey = `${pendingDestinationNodeId}:${activeText}`;
    if (completedPendingDestination.current === completionKey) return;
    completedPendingDestination.current = completionKey;
    const destination = snapshot.nodes.find((node) => node.id === pendingDestinationNodeId);
    setPendingDestinationNodeId(null);
    if (!destination) return;
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: activeText, speakerId: activeSpeakerId }]);
    showNode(snapshot, destination, playState);
  }, [typewriter.complete, pendingDestinationNodeId, snapshot, playState, activeText, activeSpeakerId]);

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
    workSurface.close();
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
        try {
          const { snapshot: project, flushedCount } = await flushQueuedAuthorMutations({
            persistence: cloudflareProjectPersistence,
            authorization: authorToken,
          });
          if (flushedCount) {
            setSnapshot(project);
            setPlayState((existing) => existing ? reconcilePlayState(project, existing) : createEmptyPlayState(project));
          }
        } finally {
          flushingQueue.current = false;
        }
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [authorToken]);

  const persist = async (
    operations: MutationOperation[],
    description: string,
    closeAfterSave = false,
  ): Promise<AuthorPersistResult> => {
    if (!snapshot || !authorToken) return { status: "failed", snapshot };
    const before = snapshot;
    const beforeState = playState;
    const optimistic = applyOperations(snapshot, operations);
    const optimisticState = playState
      ? reconcilePlayStateAfterProjectChange(snapshot, optimistic, playState)
      : null;
    const mutation: ProjectMutation = { expectedRevision: snapshot.revision, description, operations };
    setSnapshot(optimistic);
    if (optimisticState) setPlayState(optimisticState);
    setAuthorMessage("SAVING...");

    const result = await persistAuthorMutation({
      persistence: cloudflareProjectPersistence,
      authorization: authorToken,
      mutation,
      optimisticSnapshot: optimistic,
      previousSnapshot: before,
    });

    if (result.status === "saved") {
      setSnapshot(result.snapshot);
      const savedState = optimisticState ? reconcilePlayState(result.snapshot, optimisticState) : null;
      if (savedState) setPlayState(savedState);
      const changedCurrentNode = operations.some((operation) =>
        operation.type === "node.upsert" && operation.node.id === playState?.currentNodeId,
      );
      if (changedCurrentNode && savedState) {
        const changed = result.snapshot.nodes.find((node) => node.id === savedState.currentNodeId);
        if (changed) showNode(result.snapshot, changed, savedState);
      }
      if (closeAfterSave) workSurface.close();
      setAuthorMessage(`SAVED R${result.snapshot.revision}.`);
      return result;
    }

    if (result.status === "queued") {
      if (closeAfterSave) workSurface.close();
      setAuthorMessage("SAVED LOCALLY; SERVER SYNC QUEUED.");
      return result;
    }

    if (result.status === "conflict") {
      const synchronized = result.snapshot ?? before;
      setSnapshot(synchronized);
      if (beforeState) setPlayState(reconcilePlayState(synchronized, beforeState));
      setAuthorMessage("NEWER REVISION FOUND. SYNCHRONIZED; REVIEW AND SAVE AGAIN.");
      return result;
    }

    setSnapshot(before);
    if (beforeState) setPlayState(beforeState);
    setAuthorMessage("SAVE FAILED. CHANGES ARE STILL OPEN; TRY AGAIN.");
    return result;
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
    setTranscript((lines) => [...lines, {
      id: crypto.randomUUID(),
      text: activeText,
      nodeId: activeNodeId,
      speakerId: activeSpeakerId,
    }]);
  };

  const handleEffectEvents = (events: EffectEvent[], anchorLineId?: string) => {
    if (!snapshot || !events.length) return;
    presentEffectEvents(events, {
      snapshot,
      anchorLineId,
      surface: {
        notify(text, anchoredLineId) {
          const id = crypto.randomUUID();
          setNotifications((items) => [...items, { id, text, anchorLineId: anchoredLineId }]);
          window.setTimeout(() => setNotifications((items) => items.filter((item) => item.id !== id)), 4000);
        },
        appendInlineAsset(assetPath) {
          setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: "", artPath: assetPath }]);
        },
        showOverlayAsset(assetPath) {
          setEventArt(assetUrl(assetPath));
        },
      },
    });
  };

  const presentRuntimeExecution = (
    project: ProjectSnapshot,
    execution: { state: PlayState; events: EffectEvent[]; responseText: string },
    previousState: PlayState,
    commandLineId: string,
    charactersPerSecond = 18,
    speakerId: string | null = null,
  ) => {
    setPlayState(execution.state);
    handleEffectEvents(execution.events, commandLineId);
    const transitioned = execution.state.traversal.length > previousState.traversal.length;
    const destination = transitioned
      ? project.nodes.find((node) => node.id === execution.state.currentNodeId)
      : undefined;
    if (execution.responseText) {
      firedCueIds.current = new Set();
      completedPendingDestination.current = "";
      const compiled = compileTextNotation(execution.responseText, { charactersPerSecond, cues: [] });
      setActiveText(compiled.text);
      setActiveNodeId(undefined);
      setActiveSpeakerId(speakerId);
      setActivePerformance(compiled.performance);
      setPendingDestinationNodeId(destination?.id ?? null);
    } else if (destination) {
      setPendingDestinationNodeId(null);
      showNode(project, destination, execution.state);
    } else {
      setPendingDestinationNodeId(null);
      setActiveText("");
      setActiveNodeId(undefined);
      setActiveSpeakerId(null);
    }
  };

  useEffect(() => {
    for (const cue of activePerformance.cues) {
      if (cue.start > typewriter.count || firedCueIds.current.has(cue.id)) continue;
      handleEffectEvents(effectEventsForTextCue(cue));
      firedCueIds.current.add(cue.id);
    }
  }, [typewriter.count, activePerformance]);

  const handleTerminalValue = async (value: string) => {
    if (!snapshot || !playState) return;
    historyPinnedToPresentRef.current = true;
    scrollHistoryToPresent();
    const normalized = value.trim().toLowerCase();
    setCommand(""); setAuthorMessage(""); setUnhandledCommand("");

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
    if (authorMode && authorView && ["/structure", "structure"].includes(normalized)) { setPanel({ type: "structure" }); return; }
    if (authorMode && authorView && ["/definitions", "definitions"].includes(normalized)) { setPanel({ type: "definitions" }); return; }
    if (authorMode && authorView && ["/assets", "assets"].includes(normalized)) { setPanel({ type: "assets" }); return; }
    if (authorMode && authorView && ["/sounds", "sounds"].includes(normalized)) { setPanel({ type: "synth" }); return; }
    if (authorMode && authorView && ["/locations", "/bookmark", "locations"].includes(normalized)) { setPanel({ type: "workspace", view: "locations" }); return; }
    if (authorMode && authorView && ["/history", "history"].includes(normalized)) { setPanel({ type: "workspace", view: "history" }); return; }

    const currentState = advanceProjectClocks(snapshot, playState, Date.now());
    const commandState = { ...currentState, commandsEntered: currentState.commandsEntered + 1, lastCommand: value };
    const parsed = parseCommand(value, snapshot, commandState);
    setParserResult(parsed);

    if (!parsed.interaction && !parsed.invocation && authorMode && authorView) {
      const interaction = createDraftInteraction(currentState.currentNodeId, value.trim());
      setParserResult(null);
      await persist([{ type: "interaction.upsert", interaction }], `Created draft user input ${interaction.wording}`);
      return;
    }

    appendActive();
    const commandLineId = crypto.randomUUID();
    setTranscript((lines) => [...lines, { id: commandLineId, text: `${snapshot.settings.terminalPrompt}${value}`, command: true }]);

    if (parsed.invocation) {
      if (!parsed.invocation.target) {
        const capability = APPLICATION_COMMAND_CAPABILITY_BY_OPERATION[parsed.invocation.operation];
        setPlayState(commandState);
        setActiveText("");
        setActiveNodeId(undefined);
        setActiveSpeakerId(null);
        if (capability?.action.type === "open-workspace") {
          setPanel({
            type: "feature",
            feature: capability.action.feature,
            workspace: capability.action.workspace,
            data: capability.action.data,
          });
        } else if (authorMode && authorView) {
          setAuthorMessage(`COMMAND ${parsed.invocation.operation} MATCHED, BUT NO APPLICATION CAPABILITY HANDLES IT.`);
        }
        return;
      }
      const execution = executeOperation(snapshot, commandState, {
        target: parsed.invocation.target,
        operation: parsed.invocation.operation,
        arguments: parsed.invocation.arguments,
      });
      presentRuntimeExecution(snapshot, execution, commandState, commandLineId);
      if (!execution.accepted && !execution.responseText && authorMode && authorView) {
        setAuthorMessage(`TARGET DOES NOT HANDLE ${parsed.invocation.operation.toUpperCase()}.`);
      }
      return;
    }

    if (!parsed.interaction) {
      setPlayState(commandState);
      setActiveText("");
      setActiveNodeId(undefined);
      setActiveSpeakerId(null);
      if (authorMode && authorView) { setUnhandledCommand(value); setAuthorMessage(`UNHANDLED: ${parsed.reason}.`); }
      return;
    }

    const execution = executeInteraction(snapshot, commandState, parsed.interaction);
    presentRuntimeExecution(
      snapshot,
      execution,
      commandState,
      commandLineId,
      execution.outcome?.responseCharactersPerSecond ?? 18,
      execution.outcome?.speakerId ?? null,
    );
  };

  const playAuthorInput = (interaction: Interaction) => {
    const value = interaction.aliases[0] || interaction.wording;
    if (value) void handleTerminalValue(value);
  };

  const restoreBookmark = (bookmark: AuthorBookmark) => {
    if (!snapshot) return;
    const state = resumeAuthorBookmark(snapshot, bookmark);
    setPlayState(state);
    const node = snapshot?.nodes.find((candidate) => candidate.id === bookmark.nodeId);
    if (node) showNode(snapshot, node, state);
    workSurface.close(); setAuthorMessage("LOCATION LOADED.");
  };
  const applyWorkspaceState = (state: PlayState) => {
    if (!snapshot || !playState) return;
    const transitioned = state.traversal.length > playState.traversal.length;
    setPlayState(state);
    if (!transitioned) return;
    const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
    if (node) showNode(snapshot, node, state);
    workSurface.close();
  };
  const showWorkspaceOutput = (text: string) => {
    historyPinnedToPresentRef.current = true;
    appendActive();
    setActiveText("");
    setActiveNodeId(undefined);
    setActiveSpeakerId(null);
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text }]);
    workSurface.close();
    window.requestAnimationFrame(scrollHistoryToPresent);
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
  const promptLabel = requestingKey ? "ADMIN KEY>" : snapshot.settings.terminalPrompt;
  const editorOpen = Boolean(panel);
  const authorExperience = authorMode && authorView;
  const invalidDraft = Boolean(fallbackInput && notationForInput(fallbackInput) === "[D]");
  const invalidLabel = fallbackInput ? `${notationForInput(fallbackInput)} INVALID` : "[+ INVALID]";
  const authorToolGroups = buildAuthorToolGroups({
    currentNode,
    fallbackInput,
    invalidDraft,
    notationForInput,
    pushPanel: workSurface.pushPanel,
    close: workSurface.close,
    downloadBackup,
  });

  return <main className="dos-screen" aria-label="Pre-Programmed terminal" onPointerDown={() => {
    if (!typewriter.complete) typewriter.completeImmediately();
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
          {transcript.map((line) => {
            if (line.artPath) return <div className="story-line" key={line.id} aria-hidden="true"><img src={assetUrl(line.artPath)} alt="" style={{ display: "block", maxWidth: 32, maxHeight: 32, width: "auto", height: "auto", imageRendering: "pixelated" }} /></div>;
            if (authorExperience && line.nodeId) return <button type="button" className="story-edit-target transcript-node" key={line.id} onClick={(event) => { event.stopPropagation(); const node = snapshot.nodes.find((candidate) => candidate.id === line.nodeId); if (node) setPanel({ type: "node", node }); }}><SpeakerPrefix snapshot={snapshot} speakerId={line.speakerId} />{line.text}</button>;
            const anchoredNotifications = notifications.filter((item) => item.anchorLineId === line.id);
            return <div className={line.command ? "command-line" : "story-line"} key={line.id}><SpeakerPrefix snapshot={snapshot} speakerId={line.speakerId} />{line.text}{anchoredNotifications.length ? <span className="inline-floating-notifications" aria-live="polite">{anchoredNotifications.map((item) => <span key={item.id}>{item.text}</span>)}</span> : null}</div>;
          })}
          {activeText ? authorExperience && typewriter.complete && activeNodeId ? <button type="button" className="story-edit-target" onClick={(event) => { event.stopPropagation(); const node = snapshot.nodes.find((candidate) => candidate.id === activeNodeId); if (node) setPanel({ type: "node", node }); }}><SpeakerPrefix snapshot={snapshot} speakerId={activeSpeakerId} /><RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} /></button> : <div className="story-line"><SpeakerPrefix snapshot={snapshot} speakerId={activeSpeakerId} /><RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} /></div> : null}
        </div>
      </div>

      {typewriter.complete && !pendingDestinationNodeId && !panel ? <TerminalCommandComposer
        ref={terminalComposerRef}
        label={promptLabel}
        value={command}
        onChange={setCommand}
        onSubmit={(value) => { void handleTerminalValue(value); }}
        secret={requestingKey}
        immediateChoices={requestingKey ? [] : immediateTerminalChoices}
        menuChoices={requestingKey ? [] : promptTerminalChoices}
        ariaLabel={requestingKey ? "Author key" : "Universe command"}
      /> : null}

      <div className="terminal-lower" onPointerDown={(event) => event.stopPropagation()}>
        {authorExperience && typewriter.complete && !pendingDestinationNodeId && !requestingKey && !command && currentInputs.length && !panel ? <AuthorInputSurface
          choices={currentInputs}
          onChoose={playAuthorInput}
          notationForChoice={notationForInput}
          onEdit={(interaction) => setPanel({ type: "interaction", interaction })}
        /> : null}

        {authorExperience && typewriter.complete && !pendingDestinationNodeId && !panel ? <AuthorHome
          nodeNumber={currentNode.nodeNumber}
          revision={snapshot.revision}
          notation={currentNotation.join("")}
          match={parserResult ? `${parserResult.reason}${parserResult.matchedAlias ? ` / ${parserResult.matchedAlias}` : parserResult.matchedPattern ? ` / ${parserResult.matchedPattern}` : ""}` : undefined}
          invalidLabel={invalidLabel}
          invalidDraft={invalidDraft}
          message={authorMessage}
          onEditNode={() => setPanel({ type: "node", node: currentNode })}
          onEditInvalid={() => setPanel({ type: "interaction", interaction: fallbackInput, fallback: true })}
          onOpenTools={() => setPanel({ type: "tools" })}
        /> : null}
        {unhandledCommand && authorExperience && !panel ? <div className="unhandled-tools">
          <span>USER JUST INPUT: <strong>“{unhandledCommand}”</strong></span><span>NO RESPONSE IS AUTHORED.</span>
          <button type="button" onClick={() => setPanel({ type: "interaction", command: unhandledCommand })}>[WRITE WHAT THEY SEE]</button>
          <details className="alias-strip"><summary>[USE AS AN ALIAS]</summary><div>{currentInputs.map((interaction) => <button type="button" key={interaction.id} onClick={() => setPanel({ type: "interaction", interaction: { ...structuredClone(interaction), aliases: [...interaction.aliases, unhandledCommand] } })}>[{interaction.wording || interaction.aliases[0]}]</button>)}{!currentInputs.length ? <span>no current user inputs</span> : null}</div></details>
        </div> : null}

        <AuthorWorkspaceHost
          panel={panel}
          toolGroups={authorToolGroups}
          snapshot={snapshot}
          playState={playState}
          authorMode={authorExperience}
          authorToken={authorToken}
          persist={persist}
          leaveCurrentSurface={workSurface.requestBack}
          setWorkspaceDirty={workSurface.setCurrentDirty}
          pushPanel={workSurface.pushPanel}
          runtime={{
            updateState: applyWorkspaceState,
            output: showWorkspaceOutput,
            events: handleEffectEvents,
          }}
          onSnapshot={applyCanonicalSnapshot}
          onRestore={restoreBookmark}
          leaveConfirmation={workSurface.leaveConfirmation}
          onConfirmLeave={workSurface.confirmLeave}
          onCancelLeave={workSurface.cancelLeave}
        />
      </div>
    </div>
    {editorOpen ? <button className="work-surface-close" type="button" aria-label="Close Author workspace and return to play" onPointerDown={(event) => event.stopPropagation()} onClick={workSurface.requestClose}>[X]</button> : null}
    <AuthorSettings authorView={authorView} showAuthorViewToggle={authorMode} visible={!editorOpen} onToggleAuthorView={() => {
      setAuthorView((value) => !value);
      workSurface.close();
      setUnhandledCommand("");
      setAuthorMessage("");
    }} onTextSpeedMultiplierChange={setTextSpeedMultiplier} />
    <div className="floating-notifications" aria-live="polite">{notifications.filter((item) => !item.anchorLineId).map((item) => <div key={item.id}>{item.text}</div>)}</div>
    {eventArt ? <div className="event-art" onPointerDown={(event) => event.stopPropagation()}><img src={eventArt} alt="" /><button type="button" onClick={() => setEventArt("")}>[CLOSE]</button></div> : null}
  </main>;
}

function SpeakerPrefix({ snapshot, speakerId }: { snapshot: ProjectSnapshot; speakerId?: string | null }) {
  if (!speakerId) return null;
  const speaker = snapshot.entities.find((entity) => entity.type === "character" && entity.id === speakerId);
  return speaker ? <span>{speaker.name}: </span> : null;
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
