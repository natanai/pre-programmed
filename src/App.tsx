import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AuthorHome } from "./author/AuthorHome";
import {
  renderAuthorFeaturePlaySurfaces,
  resolveAuthorFeatureTerminalShortcut,
} from "./author/features/registry";
import { resolveAuthorCapability } from "./author/capabilities/runtime";
import {
  flushQueuedAuthorMutations,
  persistAuthorMutation,
  type AuthorPersistResult,
} from "./author/persistence/authorProjectPersistence";
import { authorRouteForResource, authorRouteForSource } from "./author/resources/runtime";
import { useAuthorTaskRuntime } from "./author/tasks/useAuthorTaskRuntime";
import type { AuthorTaskRoute } from "./author/tasks/types";
import { buildAuthorToolGroups } from "./author/tools/registry";
import { buildAuthorSearchEntries } from "./author/search/authorSearch";
import { AuthorWorkspaceHost } from "./author/workspace/AuthorWorkspaceHost";
import { PlayerWorkspaceHost } from "./player/workspaces/PlayerWorkspaceHost";
import type { PlayerWorkspaceRequest } from "./player/workspaces/types";
import { AuthorSettings, readDisplaySettings } from "./components/AuthorSettings";
import {
  authorLoginErrorMessage,
  checkAuthorSession,
  downloadAuthorBackup,
  isAuthorSessionExpiredError,
  loginAuthor,
  waitForProjectSnapshot,
} from "./data/api";
import {
  loadCachedSnapshot,
  saveCachedSnapshot,
} from "./data/localProject";
import {
  clearPlaySession,
  isPlaySessionCompatible,
  loadPlaySession,
  savePlaySession,
  type PersistedPlaySession,
  type PersistedTranscriptLine,
} from "./data/localPlaySession";
import { APPLICATION_COMMAND_CAPABILITY_BY_OPERATION } from "./engine/application/catalog";
import {
  advanceProjectClocks,
  hasActiveProjectClock,
  projectClockScheduleKey,
  resetProjectClocks,
} from "./engine/runtime/projectClock";
import { authoredSource, type AuthoredSourceIdentity } from "./engine/presentation/authoredSource";
import { effectEventsForTextCue } from "./engine/presentation/textCueEventCatalog";
import type { EffectEvent } from "./engine/rules/effectRuntime";
import { presentEffectEvents } from "./ui/effectPresentationCatalog";
import { buildGraphIndex, notationForNode } from "./features/narrative/graph";
import { isInteractionChoiceVisible } from "./features/narrative/choiceVisibility";
import { resolveActiveNodeAnchor } from "./features/narrative/anchor";
import { interpolateText } from "./features/narrative/interpolation";
import { applyOperations } from "./engine/project/mutations";
import {
  createEmptyPlayState,
  reconcilePlayState,
  reconcilePlayStateAfterProjectChange,
  resumeAuthorBookmark,
  resumePlayState,
} from "./engine/project/playState";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectMutation,
  ProjectSnapshot,
} from "./engine/project/model";
import type { GameNode, Interaction, TextPerformance } from "./features/narrative/model";
import { executeOperation } from "./features/operations/runtime";
import { parseCommand, type ParserResult } from "./features/commands/parser";
import { executeInteraction } from "./features/narrative/runtime";
import { compileTextNotation } from "./features/narrative/textNotation";
import { MediaAssetThumbnail, MediaAssetViewer } from "./features/media/ui/MediaAssetViewer";
import { configuredProjectPersistence } from "./platform/persistence/configuredProjectPersistence";
import {
  TerminalCommandComposer,
  type TerminalCommandChoice,
  type TerminalCommandComposerHandle,
} from "./ui/TerminalCommandComposer";
import { PlayerSessionGate } from "./ui/PlayerSessionGate";
import { useTerminalViewport } from "./ui/useTerminalViewport";

const AUTHOR_TOKEN_KEY = "pre-programmed:author-token";

type TranscriptLine = PersistedTranscriptLine;

type RuntimePresentationExecution = {
  state: PlayState;
  events: EffectEvent[];
  responseText: string;
  source?: AuthoredSourceIdentity;
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
  const [pendingAuthorTryInput, setPendingAuthorTryInput] = useState("");
  const [playerWorkspace, setPlayerWorkspace] = useState<PlayerWorkspaceRequest | null>(null);
  const authorTasks = useAuthorTaskRuntime();
  const panel = authorTasks.activeTask?.route ?? null;
  const setPanel = (next: AuthorTaskRoute | null) => next ? authorTasks.openTask(next) : authorTasks.closeAll();
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [activeText, setActiveText] = useState("");
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>();
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<AuthoredSourceIdentity | undefined>();
  const [activePerformance, setActivePerformance] = useState<TextPerformance>({ charactersPerSecond: 18, cues: [] });
  const [textSpeedMultiplier, setTextSpeedMultiplier] = useState(() => readDisplaySettings().textSpeedMultiplier);
  const [pendingDestinationNodeId, setPendingDestinationNodeId] = useState<string | null>(null);
  const [pendingPlaySession, setPendingPlaySession] = useState<PersistedPlaySession | null>(null);
  const [playSessionReady, setPlaySessionReady] = useState(false);
  const [parserResult, setParserResult] = useState<ParserResult | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; anchorLineId?: string; source?: AuthoredSourceIdentity }>>([]);
  const [eventArtAssetId, setEventArtAssetId] = useState("");
  const [eventArtSource, setEventArtSource] = useState<AuthoredSourceIdentity | undefined>();
  const terminalComposerRef = useRef<TerminalCommandComposerHandle>(null);
  const terminalHistoryRef = useRef<HTMLDivElement>(null);
  const historyPinnedToPresentRef = useRef(true);
  const firedCueIds = useRef(new Set<string>());
  const completedPendingDestination = useRef("");
  const flushingQueue = useRef(false);
  const playSessionDecisionRef = useRef<"continue" | "new" | null>(null);
  const typewriter = useTypewriter(activeText, activePerformance, textSpeedMultiplier);
  useTerminalViewport();

  const currentNode = snapshot && playState
    ? snapshot.nodes.find((node) => node.id === playState.currentNodeId) ?? null
    : null;
  const activeNodeAnchor = snapshot && playState ? resolveActiveNodeAnchor(snapshot, playState) : null;
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
  const playerChoiceInputs = snapshot && playState
    ? currentInputs.filter((interaction) => isInteractionChoiceVisible(snapshot, playState, interaction))
    : [];
  const immediateChoices = playerChoiceInputs.filter((interaction) => interaction.choiceVisibility === "immediate");
  const promptChoices = playerChoiceInputs.filter((interaction) => (interaction.choiceVisibility ?? "prompt") === "prompt");
  const immediateTerminalChoices = immediateChoices.map(terminalChoiceForInteraction).filter((choice) => choice.text);
  const promptTerminalChoices = promptChoices.map(terminalChoiceForInteraction).filter((choice) => choice.text);
  const projectClockSchedule = snapshot ? projectClockScheduleKey(snapshot) : "[]";

  const openAuthorResource = (kind: string, id: string, focus?: Record<string, string>) => {
    if (!snapshot) return;
    const route = authorRouteForResource(snapshot, kind, id, focus);
    if (route) authorTasks.openTask(route);
  };

  const openAuthorSource = (source?: AuthoredSourceIdentity) => {
    if (!snapshot || !source) return;
    const route = authorRouteForSource(snapshot, source);
    if (route) authorTasks.openTask(route);
  };

  const canEditAuthorSource = (source?: AuthoredSourceIdentity) => Boolean(
    snapshot && source && authorRouteForSource(snapshot, source),
  );

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
    if (!typewriter.complete || pendingDestinationNodeId || panel || playerWorkspace || pendingPlaySession) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const frame = window.requestAnimationFrame(() => terminalComposerRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [typewriter.complete, pendingDestinationNodeId, panel, playerWorkspace, pendingPlaySession, requestingKey]);

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
    setActiveSource(authoredSource("node", node.id));
    setActivePerformance(compiled.performance);
  };

  const continuePlaySession = () => {
    if (!snapshot || !pendingPlaySession) return;
    const session = pendingPlaySession;
    playSessionDecisionRef.current = "continue";
    const state = resumePlayState(snapshot, session.playState, session.savedAt);
    const sameRevision = session.projectRevision === snapshot.revision;
    setPlayState(state);
    setTranscript(session.presentation.transcript);
    setCommand("");
    setParserResult(null);
    setNotifications([]);
    setEventArtAssetId("");
    setEventArtSource(undefined);
    firedCueIds.current = new Set();
    completedPendingDestination.current = "";
    if (sameRevision) {
      const resumedNodeId = session.presentation.activeNodeId && snapshot.nodes.some((node) => node.id === session.presentation.activeNodeId)
        ? session.presentation.activeNodeId
        : undefined;
      setActiveText(session.presentation.activeText);
      setActiveNodeId(resumedNodeId);
      setActiveSpeakerId(session.presentation.activeSpeakerId);
      setActiveSource(session.presentation.activeSource ?? (resumedNodeId ? authoredSource("node", resumedNodeId) : undefined));
      setActivePerformance(session.presentation.activePerformance);
      setPendingDestinationNodeId(session.presentation.pendingDestinationNodeId && snapshot.nodes.some((node) => node.id === session.presentation.pendingDestinationNodeId)
        ? session.presentation.pendingDestinationNodeId
        : null);
    } else {
      setActiveText("");
      setActiveNodeId(undefined);
      setActiveSpeakerId(null);
      setActiveSource(undefined);
      setPendingDestinationNodeId(null);
      const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
      if (node) showNode(snapshot, node, state);
    }
    setPendingPlaySession(null);
    setPlaySessionReady(true);
    window.requestAnimationFrame(scrollHistoryToPresent);
  };

  const startNewGame = () => {
    if (!snapshot) return;
    playSessionDecisionRef.current = "new";
    const state = createEmptyPlayState(snapshot);
    setPlayState(state);
    setTranscript([]);
    setCommand("");
    setParserResult(null);
    setNotifications([]);
    setEventArtAssetId("");
    setEventArtSource(undefined);
    setActiveText("");
    setActiveNodeId(undefined);
    setActiveSpeakerId(null);
    setActiveSource(undefined);
    setActivePerformance({ charactersPerSecond: 18, cues: [] });
    setPendingDestinationNodeId(null);
    firedCueIds.current = new Set();
    completedPendingDestination.current = "";
    const node = snapshot.nodes.find((node) => node.id === snapshot.startNodeId);
    if (node) showNode(snapshot, node, state);
    setPendingPlaySession(null);
    setPlaySessionReady(true);
    void clearPlaySession();
  };

  useEffect(() => {
    if (!typewriter.complete || !pendingDestinationNodeId || !snapshot || !playState || !activeText) return;
    const completionKey = `${pendingDestinationNodeId}:${activeText}`;
    if (completedPendingDestination.current === completionKey) return;
    completedPendingDestination.current = completionKey;
    const destination = snapshot.nodes.find((node) => node.id === pendingDestinationNodeId);
    setPendingDestinationNodeId(null);
    if (!destination) return;
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: activeText, speakerId: activeSpeakerId, source: activeSource }]);
    showNode(snapshot, destination, playState);
  }, [typewriter.complete, pendingDestinationNodeId, snapshot, playState, activeText, activeSpeakerId, activeSource]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      const [cached, savedSession] = await Promise.all([loadCachedSnapshot(), loadPlaySession()]);
      const offerSession = (project: ProjectSnapshot) => {
        if (playSessionDecisionRef.current) {
          setPendingPlaySession(null);
          setPlaySessionReady(true);
          return;
        }
        if (savedSession && isPlaySessionCompatible(project, savedSession)) {
          setPendingPlaySession(savedSession);
          setPlaySessionReady(false);
        } else {
          setPendingPlaySession(null);
          setPlaySessionReady(true);
        }
      };
      if (cached && !cancelled) {
        setConnectionState("ready");
        const state = createEmptyPlayState(cached);
        setSnapshot(cached);
        setPlayState(state);
        const node = cached.nodes.find((item) => item.id === cached.startNodeId);
        if (node) showNode(cached, node, state);
        offerSession(cached);
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
          const existingCompatible = Boolean(existing && project.nodes.some((node) => node.id === existing.currentNodeId));
          const state = existing && existingCompatible
            ? reconcilePlayState(project, existing)
            : createEmptyPlayState(project);
          const decision = playSessionDecisionRef.current;
          const shouldRefreshPresentation = !decision
            || !existingCompatible
            || (decision === "continue" && Boolean(savedSession) && savedSession!.projectRevision !== project.revision);
          if (shouldRefreshPresentation) {
            const node = project.nodes.find((item) => item.id === state.currentNodeId);
            if (node) showNode(project, node, state);
          }
          return state;
        });
        offerSession(project);
        if (savedSession && !isPlaySessionCompatible(project, savedSession) && !playSessionDecisionRef.current) void clearPlaySession();
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

  useEffect(() => {
    if (!snapshot || !playState || !playSessionReady || pendingPlaySession || authorTasks.hasTasks) return;
    const timer = window.setTimeout(() => {
      void savePlaySession({
        version: 2,
        schemaVersion: snapshot.schemaVersion,
        projectRevision: snapshot.revision,
        savedAt: new Date().toISOString(),
        playState,
        presentation: {
          transcript,
          activeText,
          activeNodeId,
          activeSpeakerId,
          activePerformance,
          pendingDestinationNodeId,
          activeSource,
        },
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    snapshot,
    playState,
    playSessionReady,
    pendingPlaySession,
    authorTasks.hasTasks,
    transcript,
    activeText,
    activeNodeId,
    activeSpeakerId,
    activePerformance,
    pendingDestinationNodeId,
    activeSource,
  ]);

  const clearAuthorSession = () => {
    sessionStorage.removeItem(AUTHOR_TOKEN_KEY);
    setAuthorToken("");
    setAuthorMode(false);
    setAuthorView(true);
    authorTasks.closeAll();
  };

  useEffect(() => {
    if (!authorToken) return;
    let cancelled = false;
    const synchronizeQueue = async () => {
      if (cancelled || flushingQueue.current) return;
      flushingQueue.current = true;
      try {
        const { snapshot: project, flushedCount } = await flushQueuedAuthorMutations({
          persistence: configuredProjectPersistence,
          authorization: authorToken,
        });
        if (cancelled || !flushedCount || !project) return;
        setSnapshot(project);
        setPlayState((existing) => existing ? reconcilePlayState(project, existing) : createEmptyPlayState(project));
        setAuthorMessage(`SYNCED ${flushedCount} LOCAL ${flushedCount === 1 ? "CHANGE" : "CHANGES"}. SAVED R${project.revision}.`);
      } finally {
        flushingQueue.current = false;
      }
    };
    void checkAuthorSession(authorToken)
      .then(async (valid) => {
        if (cancelled) return;
        if (!valid) { clearAuthorSession(); return; }
        setAuthorMode(true);
        setAuthorView(true);
        await synchronizeQueue();
      }).catch(() => undefined);
    const onOnline = () => void synchronizeQueue().catch(() => undefined);
    window.addEventListener("online", onOnline);
    const retryTimer = window.setInterval(() => void synchronizeQueue().catch(() => undefined), 15_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.clearInterval(retryTimer);
    };
  }, [authorToken]);

  const persist = async (
    operations: MutationOperation[],
    description: string,
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
      persistence: configuredProjectPersistence,
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
      setAuthorMessage(`SAVED R${result.snapshot.revision}.`);
      return result;
    }

    if (result.status === "queued") {
      setAuthorMessage("SAVED ONLY IN THIS BROWSER; SERVER SYNC PENDING.");
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
    setAuthorMessage(result.message
      ? `SAVE REJECTED: ${result.message}`
      : "SAVE FAILED. CHANGES ARE STILL OPEN; TRY AGAIN.");
    return result;
  };

  const downloadBackup = async () => {
    if (!authorToken) return;
    setAuthorMessage("BACKING UP...");
    try {
      const { blob, filename } = await downloadAuthorBackup(authorToken);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
      setAuthorMessage("BACKUP DOWNLOADED.");
    } catch (error) {
      if (isAuthorSessionExpiredError(error)) {
        clearAuthorSession();
        setAuthorMessage("AUTHOR SESSION EXPIRED.");
        return;
      }
      setAuthorMessage("BACKUP FAILED.");
    }
  };

  const appendActive = () => {
    if (!activeText) return;
    setTranscript((lines) => [...lines, {
      id: crypto.randomUUID(),
      text: activeText,
      nodeId: activeNodeId,
      speakerId: activeSpeakerId,
      source: activeSource,
    }]);
  };

  const handleEffectEvents = (events: EffectEvent[], anchorLineId?: string) => {
    if (!snapshot || !events.length) return;
    presentEffectEvents(events, {
      snapshot,
      anchorLineId,
      surface: {
        notify(text, anchoredLineId, source) {
          const id = crypto.randomUUID();
          setNotifications((items) => [...items, { id, text, anchorLineId: anchoredLineId, source }]);
          window.setTimeout(() => setNotifications((items) => items.filter((item) => item.id !== id)), 4000);
        },
        appendInlineAsset(assetId, source) {
          setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text: "", artAssetId: assetId, source }]);
        },
        showOverlayAsset(assetId, source) {
          setEventArtAssetId(assetId);
          setEventArtSource(source);
        },
      },
    });
  };

  const presentRuntimeExecution = (
    project: ProjectSnapshot,
    execution: RuntimePresentationExecution,
    previousState: PlayState,
    commandLineId: string,
    performance: TextPerformance = { charactersPerSecond: 18, cues: [] },
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
      const compiled = compileTextNotation(execution.responseText, performance);
      setActiveText(compiled.text);
      setActiveNodeId(undefined);
      setActiveSpeakerId(speakerId);
      setActiveSource(execution.source);
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
      setActiveSource(undefined);
    }
  };

  useEffect(() => {
    for (const cue of activePerformance.cues) {
      if (cue.start > typewriter.count || firedCueIds.current.has(cue.id)) continue;
      const events = effectEventsForTextCue(cue).map((event) => activeSource ? { ...event, source: activeSource } : event);
      handleEffectEvents(events);
      firedCueIds.current.add(cue.id);
    }
  }, [typewriter.count, activePerformance, activeSource]);

  const handleTerminalValue = async (value: string) => {
    if (!snapshot || !playState || pendingPlaySession) return;
    historyPinnedToPresentRef.current = true;
    scrollHistoryToPresent();
    const normalized = value.trim().toLowerCase();
    setCommand(""); setAuthorMessage("");

    if (requestingKey) {
      try {
        const token = await loginAuthor(value);
        sessionStorage.setItem(AUTHOR_TOKEN_KEY, token); setAuthorToken(token); setAuthorMode(true); setAuthorView(true); setRequestingKey(false); setAuthorMessage("");
      } catch (error) { setAuthorMessage(authorLoginErrorMessage(error)); }
      return;
    }
    if (!value.trim()) return;
    if (normalized === "admin") { if (authorMode) { setAuthorView(true); setAuthorMessage(""); } else setRequestingKey(true); return; }
    if (normalized === "logout" && authorMode) { clearAuthorSession(); return; }
    if (authorMode && authorView && (normalized === "backup" || normalized === "/backup")) { await downloadBackup(); return; }
    if (authorMode && authorView) {
      const featureShortcut = resolveAuthorFeatureTerminalShortcut(normalized);
      if (featureShortcut) { setPanel(featureShortcut); return; }
    }
    if (authorMode && authorView && ["/locations", "/bookmark", "locations"].includes(normalized)) { setPanel({ type: "workspace", view: "locations" }); return; }
    if (authorMode && authorView && ["/history", "history"].includes(normalized)) { setPanel({ type: "workspace", view: "history" }); return; }

    const currentState = advanceProjectClocks(snapshot, playState, Date.now());
    const commandState = { ...currentState, commandsEntered: currentState.commandsEntered + 1, lastCommand: value };
    const parsed = parseCommand(value, snapshot, commandState);
    setParserResult(parsed);

    appendActive();
    const commandLineId = crypto.randomUUID();
    setTranscript((lines) => [...lines, { id: commandLineId, text: `${snapshot.settings.terminalPrompt}${value}`, command: true }]);

    if (parsed.reason === "fallback" && authorMode && authorView) {
      const resolution = resolveAuthorCapability({
        capability: "input.capture-unmatched",
        data: { sourceNodeId: currentState.currentNodeId, input: value.trim() },
      }, { snapshot, playState: currentState });
      if (resolution?.type === "mutation") {
        const result = await persist(resolution.operations, resolution.description);
        if (result.status === "saved" || result.status === "queued") {
          setAuthorMessage(resolution.message ?? "DRAFT INPUT CREATED.");
        }
      }
      if (resolution?.type === "handled") {
        setAuthorMessage(resolution.message ?? "INPUT CAPTURED.");
      }
    }

    if (parsed.invocation) {
      if (!parsed.invocation.target) {
        const capability = APPLICATION_COMMAND_CAPABILITY_BY_OPERATION[parsed.invocation.operation];
        setPlayState(commandState);
        setActiveText("");
        setActiveNodeId(undefined);
        setActiveSpeakerId(null);
        setActiveSource(undefined);
        if (capability?.action.type === "open-player-workspace") {
          setPlayerWorkspace({
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
      const responseAction = parsed.invocation.action.type === "response" ? parsed.invocation.action : null;
      presentRuntimeExecution(
        snapshot,
        execution,
        commandState,
        commandLineId,
        responseAction?.responsePerformance ?? { charactersPerSecond: 18, cues: [] },
        responseAction?.speakerId ?? null,
      );
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
      setActiveSource(undefined);
      if (authorMode && authorView) setAuthorMessage(`UNHANDLED: ${parsed.reason}.`);
      return;
    }

    const execution = executeInteraction(snapshot, commandState, parsed.interaction);
    presentRuntimeExecution(
      snapshot,
      execution,
      commandState,
      commandLineId,
      execution.outcome?.responsePerformance ?? { charactersPerSecond: 18, cues: [] },
      execution.outcome?.speakerId ?? null,
    );
  };

  useEffect(() => {
    if (!pendingAuthorTryInput || authorTasks.hasTasks) return;
    const input = pendingAuthorTryInput;
    setPendingAuthorTryInput("");
    void handleTerminalValue(input);
  }, [pendingAuthorTryInput, authorTasks.hasTasks, snapshot?.revision]);

  const restoreBookmark = (bookmark: AuthorBookmark) => {
    if (!snapshot) return;
    const state = resumeAuthorBookmark(snapshot, bookmark);
    setPlayState(state);
    const node = snapshot?.nodes.find((candidate) => candidate.id === bookmark.nodeId);
    if (node) showNode(snapshot, node, state);
    authorTasks.closeAll(); setAuthorMessage("LOCATION LOADED.");
  };
  const applyWorkspaceState = (state: PlayState) => {
    if (!snapshot || !playState) return;
    const transitioned = state.traversal.length > playState.traversal.length;
    setPlayState(state);
    if (!transitioned) return;
    const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
    if (node) showNode(snapshot, node, state);
    authorTasks.closeAll();
  };
  const showWorkspaceOutput = (text: string) => {
    historyPinnedToPresentRef.current = true;
    appendActive();
    setActiveText("");
    setActiveNodeId(undefined);
    setActiveSpeakerId(null);
    setActiveSource(undefined);
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text }]);
    authorTasks.closeAll();
    window.requestAnimationFrame(scrollHistoryToPresent);
  };
  const applyPlayerWorkspaceState = (state: PlayState) => {
    if (!snapshot || !playState) return;
    const transitioned = state.traversal.length > playState.traversal.length;
    setPlayState(state);
    if (!transitioned) return;
    const node = snapshot.nodes.find((candidate) => candidate.id === state.currentNodeId);
    if (node) showNode(snapshot, node, state);
    setPlayerWorkspace(null);
  };
  const showPlayerWorkspaceOutput = (text: string, source?: AuthoredSourceIdentity) => {
    historyPinnedToPresentRef.current = true;
    appendActive();
    setActiveText("");
    setActiveNodeId(undefined);
    setActiveSpeakerId(null);
    setActiveSource(undefined);
    setTranscript((lines) => [...lines, { id: crypto.randomUUID(), text, source }]);
    setPlayerWorkspace(null);
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
  const editorOpen = authorTasks.hasTasks;
  const playerWorkspaceOpen = playerWorkspace !== null;
  const authorExperience = authorMode && authorView;
  const invalidDraft = Boolean(fallbackInput && notationForInput(fallbackInput) === "[D]");
  const invalidLabel = fallbackInput ? `${notationForInput(fallbackInput)} INVALID` : "[+ INVALID]";
  const matchedAuthorSource = parserResult?.invocation
    ? authoredSource("player-command", parserResult.invocation.commandId)
    : parserResult?.interaction
      ? authoredSource("interaction", parserResult.interaction.id)
      : undefined;
  const matchedAuthorRoute = matchedAuthorSource ? authorRouteForSource(snapshot, matchedAuthorSource) : undefined;
  const activePresentationSource = activeSource ?? (activeNodeId ? authoredSource("node", activeNodeId) : undefined);
  const activePresentationEditable = authorExperience && typewriter.complete && canEditAuthorSource(activePresentationSource);
  const authorToolGroups = buildAuthorToolGroups({
    snapshot,
    playState,
    pushTask: authorTasks.pushTask,
    closeAll: authorTasks.closeAll,
    downloadBackup,
  });
  const authorSearchEntries = buildAuthorSearchEntries({
    snapshot,
    playState,
    pushTask: authorTasks.pushTask,
    closeAll: authorTasks.closeAll,
    downloadBackup,
  }, authorToolGroups);

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
            const artAssetId = line.artAssetId;
            const lineSource = line.source ?? (line.nodeId ? authoredSource("node", line.nodeId) : undefined);
            const lineEditable = authorExperience && canEditAuthorSource(lineSource);
            const anchoredNotifications = notifications.filter((item) => item.anchorLineId === line.id);
            if (artAssetId) return <div className="story-line story-media-line" key={line.id}>
              <MediaAssetThumbnail
                snapshot={snapshot}
                assetId={artAssetId}
                onOpen={() => {
                  setEventArtAssetId(artAssetId);
                  setEventArtSource(lineSource);
                }}
                onEdit={authorExperience ? () => openAuthorResource("media-image", artAssetId) : undefined}
              />
              {lineEditable ? <button type="button" className="story-source-edit" onClick={() => openAuthorSource(lineSource)}>[EDIT SOURCE]</button> : null}
            </div>;
            return <div className={line.command ? "command-line" : "story-line"} key={line.id}>
              <SpeakerPrefix
                snapshot={snapshot}
                speakerId={line.speakerId}
                onEdit={authorExperience && line.speakerId ? () => openAuthorResource("character", line.speakerId!) : undefined}
              />
              {lineEditable && !line.command
                ? <button type="button" className="story-inline-edit-target" onClick={() => openAuthorSource(lineSource)}>{line.text}</button>
                : line.text}
              {anchoredNotifications.length ? <span className="inline-floating-notifications" aria-live="polite">{anchoredNotifications.map((item) => authorExperience && canEditAuthorSource(item.source)
                ? <button type="button" className="notification-edit-target" key={item.id} onClick={() => openAuthorSource(item.source)}>{item.text}</button>
                : <span key={item.id}>{item.text}</span>)}</span> : null}
            </div>;
          })}
          {activeText ? <div className="story-line">
            <SpeakerPrefix
              snapshot={snapshot}
              speakerId={activeSpeakerId}
              onEdit={authorExperience && activeSpeakerId ? () => openAuthorResource("character", activeSpeakerId!) : undefined}
            />
            {activePresentationEditable
              ? <button type="button" className="story-inline-edit-target" onClick={() => openAuthorSource(activePresentationSource)}><RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} /></button>
              : <RenderedPerformanceText text={typewriter.visibleText} performance={activePerformance} />}
          </div> : null}
        </div>
      </div>

      {!panel && !playerWorkspace && !pendingPlaySession ? <TerminalCommandComposer
        ref={terminalComposerRef}
        label={promptLabel}
        value={command}
        onChange={setCommand}
        onSubmit={(value) => {
          if (!typewriter.complete || pendingDestinationNodeId) {
            typewriter.completeImmediately();
            return;
          }
          void handleTerminalValue(value);
        }}
        secret={requestingKey}
        immediateChoices={requestingKey || !typewriter.complete || Boolean(pendingDestinationNodeId) ? [] : immediateTerminalChoices}
        menuChoices={requestingKey || !typewriter.complete || Boolean(pendingDestinationNodeId) ? [] : promptTerminalChoices}
        anchor={!requestingKey && !pendingDestinationNodeId && activeNodeAnchor ? {
          text: activeNodeAnchor.text,
          onEdit: authorExperience ? () => openAuthorResource("node", activeNodeAnchor.sourceNodeId) : undefined,
        } : null}
        ariaLabel={requestingKey ? "Author key" : "Universe command"}
      /> : null}

      <div className="terminal-lower" onPointerDown={(event) => event.stopPropagation()}>
        {authorExperience && typewriter.complete && !pendingDestinationNodeId && !requestingKey && !command && !panel && !playerWorkspace && !pendingPlaySession
          ? renderAuthorFeaturePlaySurfaces({
            snapshot,
            playState,
            pushTask: authorTasks.pushTask,
            submitInput: (input) => { void handleTerminalValue(input); },
          })
          : null}

        {authorExperience && typewriter.complete && !pendingDestinationNodeId && !panel && !playerWorkspace && !pendingPlaySession ? <AuthorHome
          nodeNumber={currentNode.nodeNumber}
          revision={snapshot.revision}
          notation={currentNotation.join("")}
          match={parserResult ? `${parserResult.reason}${parserResult.matchedAlias ? ` / ${parserResult.matchedAlias}` : parserResult.matchedPattern ? ` / ${parserResult.matchedPattern}` : ""}` : undefined}
          invalidLabel={invalidLabel}
          invalidDraft={invalidDraft}
          message={authorMessage}
          onEditNode={() => openAuthorResource("node", currentNode.id)}
          onEditInvalid={() => setPanel({
            type: "feature",
            feature: "narrative",
            workspace: "interaction",
            data: { ...(fallbackInput ? { interactionId: fallbackInput.id } : {}), fallback: "true" },
          })}
          onEditMatch={matchedAuthorRoute ? () => openAuthorSource(matchedAuthorSource) : undefined}
          onEditPrompt={() => openAuthorResource("project-terminal", "terminal")}
          onOpenTools={() => setPanel({ type: "tools" })}
        /> : null}

        <AuthorWorkspaceHost
          tasks={authorTasks.tasks}
          activeTaskId={authorTasks.activeTaskId}
          toolGroups={authorToolGroups}
          searchEntries={authorSearchEntries}
          snapshot={snapshot}
          playState={playState}
          authorMode={authorExperience}
          authorToken={authorToken}
          persist={persist}
          completeTask={authorTasks.completeTask}
          requestBack={authorTasks.requestBack}
          setTaskDirty={authorTasks.setTaskDirty}
          pushTask={authorTasks.pushTask}
          runtime={{
            updateState: applyWorkspaceState,
            output: showWorkspaceOutput,
            events: handleEffectEvents,
            preview: ({ text, performance, speakerId = null, events = [] }) => {
              firedCueIds.current = new Set();
              const compiled = compileTextNotation(text, performance);
              setActiveText(compiled.text);
              setActiveNodeId(undefined);
              setActiveSpeakerId(speakerId);
              setActiveSource(undefined);
              setActivePerformance(compiled.performance);
              setPendingDestinationNodeId(null);
              handleEffectEvents(events);
            },
            tryInput: (input) => {
              setPendingAuthorTryInput(input);
              authorTasks.closeAll();
            },
          }}
          onSnapshot={applyCanonicalSnapshot}
          onRestore={restoreBookmark}
          leaveConfirmation={authorTasks.leaveConfirmation}
          onConfirmLeave={authorTasks.confirmLeave}
          onCancelLeave={authorTasks.cancelLeave}
          requestClose={authorTasks.requestClose}
        />
        <PlayerWorkspaceHost
          request={playerWorkspace}
          context={{
            snapshot,
            playState,
            updateState: applyPlayerWorkspaceState,
            output: showPlayerWorkspaceOutput,
            events: handleEffectEvents,
            author: authorExperience ? {
              openWorkspace: (feature, workspace, data) => authorTasks.openTask({
                type: "feature",
                feature,
                workspace,
                data,
              }),
              editResource: (kind, id, focus) => {
                const route = authorRouteForResource(snapshot, kind, id, focus);
                if (route) authorTasks.openTask(route);
              },
            } : undefined,
          }}
          onNavigate={setPlayerWorkspace}
          onClose={() => setPlayerWorkspace(null)}
        />
      </div>
    </div>
    <AuthorSettings authorView={authorView} showAuthorViewToggle={authorMode} visible={!editorOpen && !playerWorkspaceOpen && !pendingPlaySession} onToggleAuthorView={() => {
      setAuthorView((value) => !value);
      authorTasks.closeAll();
      setAuthorMessage("");
    }} onTextSpeedMultiplierChange={setTextSpeedMultiplier} />
    <div className="floating-notifications" aria-live="polite">{notifications.filter((item) => !item.anchorLineId).map((item) => authorExperience && canEditAuthorSource(item.source)
      ? <button type="button" className="notification-edit-target" key={item.id} onClick={() => openAuthorSource(item.source)}>{item.text}</button>
      : <div key={item.id}>{item.text}</div>)}</div>
    {eventArtAssetId ? <MediaAssetViewer
      snapshot={snapshot}
      assetId={eventArtAssetId}
      onEdit={authorExperience ? () => openAuthorResource("media-image", eventArtAssetId) : undefined}
      onEditSource={authorExperience && canEditAuthorSource(eventArtSource) ? () => openAuthorSource(eventArtSource) : undefined}
      onClose={() => {
        setEventArtAssetId("");
        setEventArtSource(undefined);
      }}
    /> : null}
    {pendingPlaySession ? <PlayerSessionGate session={pendingPlaySession} onContinue={continuePlaySession} onNewGame={startNewGame} /> : null}
  </main>;
}

function SpeakerPrefix({ snapshot, speakerId, onEdit }: { snapshot: ProjectSnapshot; speakerId?: string | null; onEdit?: () => void }) {
  if (!speakerId) return null;
  const speaker = snapshot.entities.find((entity) => entity.type === "character" && entity.id === speakerId);
  if (!speaker) return null;
  return onEdit
    ? <button type="button" className="story-speaker-edit" onClick={onEdit}>{speaker.name}: </button>
    : <span>{speaker.name}: </span>;
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
