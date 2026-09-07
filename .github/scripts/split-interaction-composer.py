from pathlib import Path

path = Path("src/features/narrative/author/InteractionEditor.tsx")
text = path.read_text()

old_import = 'import { useEffect, useMemo, useState } from "react";'
new_import = 'import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";'
assert old_import in text
text = text.replace(old_import, new_import, 1)

old_screen = '''type EditorScreen =\n  | { type: "overview" }\n  | { type: "response"; outcomeId: string }\n  | { type: "input-settings" };'''
new_screen = '''export type InteractionEditorScreen =\n  | { type: "overview" }\n  | { type: "response"; outcomeId: string }\n  | { type: "input-settings" };'''
assert old_screen in text
text = text.replace(old_screen, new_screen, 1)

start = text.index('export function InteractionEditor({')
end = text.index('\nfunction InteractionOverview(', start)

replacement = r'''export function InteractionEditor({
  snapshot,
  playState,
  sourceNodeId,
  initial,
  initialCommand = "",
  initialOutcomeId,
  fallback = false,
  onSave,
  onDirtyChange,
  onRegisterSave,
  onPreview,
  onCreateDestination,
  onEditDestination,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  sourceNodeId?: string;
  initial?: Interaction;
  initialCommand?: string;
  initialOutcomeId?: string;
  fallback?: boolean;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onDirtyChange: (dirty: boolean) => void;
  onRegisterSave?: (handler: AuthorWorkspaceSaveHandler | null) => void;
  onPreview?: (value: AuthoredTextValue, speakerId: string | null, outcome: InteractionOutcome) => void;
  onCreateDestination?: (onCreated: (nodeId: string) => void) => void;
  onEditDestination?: (nodeId: string) => void;
}) {
  const fallbackMode = fallback || initial?.matchMode === "fallback";
  const resolvedSourceNodeId = initial?.sourceNodeId ?? sourceNodeId ?? playState.currentNodeId;
  const [draft, setDraft] = useState(() => normalizeInteractionAuthorDraft(initial, resolvedSourceNodeId, initialCommand, fallbackMode));
  const [newOutcomeIds, setNewOutcomeIds] = useState<Set<string>>(() => new Set());
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(draft));
  const [screen, setScreen] = useState<InteractionEditorScreen>(() => initialOutcomeId && draft.outcomes.some((outcome) => outcome.id === initialOutcomeId)
    ? { type: "response", outcomeId: initialOutcomeId }
    : { type: "overview" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const draftSignature = JSON.stringify(draft);

  useEffect(() => {
    onDirtyChange(draftSignature !== savedSignature);
    return () => onDirtyChange(false);
  }, [draftSignature, savedSignature, onDirtyChange]);

  const save = async (): Promise<boolean> => {
    const prepared = prepareInteractionForSave(draft, fallbackMode, snapshot);
    if ("issue" in prepared) {
      setError(prepared.issue.message);
      setScreen(prepared.issue.outcomeId
        ? { type: "response", outcomeId: prepared.issue.outcomeId }
        : { type: "overview" });
      return false;
    }

    setError("");
    setSaving(true);
    try {
      const { interaction } = prepared;
      const result = await onSave(
        [{ type: "interaction.upsert", interaction }],
        interactionSaveDescription(interaction, Boolean(initial), fallbackMode, snapshot),
      );
      if (result.status === "saved" || result.status === "queued") {
        setDraft(interaction);
        setNewOutcomeIds(new Set());
        setSavedSignature(JSON.stringify(interaction));
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(save);
    return () => onRegisterSave(null);
  });

  const footer = <div className="author-actions author-panel-footer guided-editor-footer">
    <button type="button" onClick={() => void save()} disabled={saving}>[{saving ? "SAVING..." : "SAVE"}]</button>
    {screen.type === "overview" && initial ? confirmDelete ? <>
      <span>Delete this {fallbackMode ? "invalid-input response" : draft.matchMode === "capture" ? "player-input capture" : "user input"}?</span>
      <button type="button" onClick={() => void onSave(
        [{ type: "interaction.delete", id: initial.id }],
        fallbackMode ? "Deleted invalid-input response" : draft.matchMode === "capture" ? "Deleted player-input capture" : `Deleted user input ${initial.wording || initial.aliases[0]}`,
      )}>[CONFIRM DELETE]</button>
      <button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button>
    </> : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE INPUT]</button> : null}
  </div>;

  return <InteractionComposer
    snapshot={snapshot}
    playState={playState}
    draft={draft}
    setDraft={setDraft}
    fallbackMode={fallbackMode}
    isNew={!initial}
    screen={screen}
    setScreen={setScreen}
    newOutcomeIds={newOutcomeIds}
    setNewOutcomeIds={setNewOutcomeIds}
    error={error}
    onClearError={() => setError("")}
    onPreview={onPreview}
    onCreateDestination={onCreateDestination}
    onEditDestination={onEditDestination}
    footer={footer}
  />;
}

/**
 * Controlled specialized interaction composer. It owns only sub-screen and
 * response-composition presentation; callers own the canonical Interaction
 * draft, dirty baseline, validation, and persistence lifecycle.
 */
export function InteractionComposer({
  snapshot,
  playState,
  draft,
  setDraft,
  fallbackMode,
  isNew,
  screen,
  setScreen,
  newOutcomeIds,
  setNewOutcomeIds,
  error,
  onClearError,
  onPreview,
  onCreateDestination,
  onEditDestination,
  footer,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  draft: Interaction;
  setDraft: Dispatch<SetStateAction<Interaction>>;
  fallbackMode: boolean;
  isNew: boolean;
  screen: InteractionEditorScreen;
  setScreen: Dispatch<SetStateAction<InteractionEditorScreen>>;
  newOutcomeIds: Set<string>;
  setNewOutcomeIds: Dispatch<SetStateAction<Set<string>>>;
  error?: string;
  onClearError?: () => void;
  onPreview?: (value: AuthoredTextValue, speakerId: string | null, outcome: InteractionOutcome) => void;
  onCreateDestination?: (onCreated: (nodeId: string) => void) => void;
  onEditDestination?: (nodeId: string) => void;
  footer?: ReactNode;
}) {
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const captureMode = !fallbackMode && draft.matchMode === "capture";
  const sourceTraversalIndex = playState.traversal.lastIndexOf(draft.sourceNodeId);
  const sourcePlayState = sourceTraversalIndex >= 0
    ? { ...playState, currentNodeId: draft.sourceNodeId, traversal: playState.traversal.slice(0, sourceTraversalIndex + 1) }
    : { ...playState, currentNodeId: draft.sourceNodeId };
  const conversationCharacterId = resolveNodeConversationContext(snapshot, sourcePlayState, draft.sourceNodeId)?.characterId ?? null;

  const configureOutcome = (id: string, change: (outcome: InteractionOutcome) => InteractionOutcome) => {
    setDraft((current) => ({
      ...current,
      outcomes: current.outcomes.map((item) => item.id === id
        ? { ...change(item), authorStatus: "configured" }
        : item),
    }));
  };

  const addResponseDraft = () => {
    const outcome = createDraftOutcome(draft.outcomes.length);
    setDraft((current) => ({ ...current, outcomes: [...current.outcomes, outcome] }));
    setNewOutcomeIds((current) => new Set(current).add(outcome.id));
    setScreen({ type: "response", outcomeId: outcome.id });
  };

  const moveOutcome = (outcomeId: string, direction: -1 | 1) => {
    setDraft((current) => {
      const index = current.outcomes.findIndex((outcome) => outcome.id === outcomeId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.outcomes.length) return current;
      const outcomes = [...current.outcomes];
      [outcomes[index], outcomes[target]] = [outcomes[target], outcomes[index]];
      return { ...current, outcomes: outcomes.map((item, order) => ({ ...item, order })) };
    });
  };

  const removeOutcome = (outcomeId: string) => {
    setDraft((current) => ({
      ...current,
      outcomes: current.outcomes.filter((outcome) => outcome.id !== outcomeId).map((outcome, order) => ({ ...outcome, order })),
    }));
    setNewOutcomeIds((current) => {
      const next = new Set(current);
      next.delete(outcomeId);
      return next;
    });
    setScreen({ type: "overview" });
  };

  const notationForOutcome = (outcome: InteractionOutcome) => {
    if (outcome.authorStatus === "draft") return "[D]";
    if (outcome.disposition === "stay" || !outcome.destinationNodeId) return "[H]";
    return notationForNode(snapshot, graph, draft.sourceNodeId, sourcePlayState.traversal, outcome.destinationNodeId).join("") || "[A1]";
  };

  const selectedOutcome = "outcomeId" in screen
    ? draft.outcomes.find((outcome) => outcome.id === screen.outcomeId)
    : undefined;

  const back = () => {
    onClearError?.();
    setScreen({ type: "overview" });
  };

  const title = screen.type === "overview"
    ? fallbackMode ? "INVALID INPUT" : captureMode ? "CAPTURE PLAYER INPUT" : (draft.wording.trim() || "NEW USER INPUT").toUpperCase()
    : screen.type === "input-settings" ? "INPUT SETTINGS"
    : `RESPONSE ${Math.max(1, draft.outcomes.findIndex((outcome) => outcome.id === screen.outcomeId) + 1)}`;

  return <section className="interaction-editor-panel guided-interaction-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header className="guided-editor-header">
      {screen.type !== "overview" ? <button type="button" className="guided-back" onClick={back} aria-label="Back to input">[‹ INPUT]</button> : null}
      <span>{title}</span>
      <small>#{snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}</small>
    </header>

    <div className="author-panel-body guided-editor-body">
      {screen.type === "overview" ? <InteractionOverview
        draft={draft}
        fallbackMode={fallbackMode}
        captureMode={captureMode}
        snapshot={snapshot}
        conversationCharacterId={conversationCharacterId}
        notationForOutcome={notationForOutcome}
        autoFocusWording={isNew}
        onWording={(wording) => setDraft({ ...draft, wording })}
        onMatchMode={(matchMode) => setDraft({ ...draft, matchMode })}
        onOpenResponse={(outcomeId) => setScreen({ type: "response", outcomeId })}
        onAddResponse={addResponseDraft}
        onOpenSettings={() => setScreen({ type: "input-settings" })}
      /> : null}

      {screen.type === "input-settings" ? <InputSettings
        draft={draft}
        fallbackMode={fallbackMode}
        captureMode={captureMode}
        snapshot={snapshot}
        onChange={setDraft}
      /> : null}

      {screen.type === "response" && selectedOutcome ? <ResponseWorkspace
        outcome={selectedOutcome}
        snapshot={snapshot}
        index={draft.outcomes.findIndex((outcome) => outcome.id === selectedOutcome.id)}
        total={draft.outcomes.length}
        notation={notationForOutcome(selectedOutcome)}
        autoFocusText={isNew || newOutcomeIds.has(selectedOutcome.id)}
        conversationCharacterId={conversationCharacterId}
        onPreview={onPreview ? (value, speakerId) => onPreview(value, speakerId, selectedOutcome) : undefined}
        playState={sourcePlayState}
        onCreateDestination={onCreateDestination ? () => onCreateDestination((nodeId) => configureOutcome(selectedOutcome.id, (outcome) => ({
          ...outcome,
          disposition: "transition",
          destinationNodeId: nodeId,
        }))) : undefined}
        onEditDestination={onEditDestination}
        onChange={(change) => configureOutcome(selectedOutcome.id, change)}
        onMove={(direction) => moveOutcome(selectedOutcome.id, direction)}
        onRemove={draft.outcomes.length > 1 ? () => removeOutcome(selectedOutcome.id) : undefined}
      /> : null}

      {error ? <div className="author-message guided-editor-error" role="alert">{error}</div> : null}
    </div>

    {footer ?? null}
  </section>;
}
'''

text = text[:start] + replacement + text[end:]
path.write_text(text)
