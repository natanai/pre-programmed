import { useEffect, useMemo, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { buildSearchIndex, searchProject } from "../../../author/search/projectSearch";
import { AuthorUiBlocks } from "../../../author/ui/AuthorWorkspaceRenderer";
import type { AuthorWorkspaceSaveHandler } from "../../../author/features/types";
import { ConditionEditor } from "../../../author/ConditionEditor";
import { ALWAYS, type Condition } from "../../../engine/rules/model";
import type {
  MutationOperation,
  PlayState,
  ProjectSnapshot,
} from "../../../engine/project/model";
import type {
  Interaction,
  InteractionChoiceVisibility,
  InteractionOutcome,
} from "../model";
import {
  OutcomeComposerSection,
  OutcomeConditionEditor,
  OutcomeEffectsEditor,
} from "../../../author/outcomes/OutcomeComposer";
import { createDraftInteraction, createDraftOutcome } from "../drafts";
import { buildGraphIndex, notationForNode } from "../graph";
import { interactionOutcomeProse, normalizeInteractionOutcomeProse } from "../interactionProse";
import { resolveNodeConversationContext } from "../sceneContext";
import { AuthoredTextEditor, type AuthoredTextValue } from "./AuthoredTextEditor";
import { validateTextNotation } from "../textNotation";
import "./interactionEditor.css";

const revealOptions: Array<{ value: InteractionChoiceVisibility; label: string; help: string }> = [
  { value: "immediate", label: "VISIBLE", help: "Show this choice without opening the prompt menu." },
  { value: "prompt", label: "ON PROMPT", help: "Show this choice when the player opens available options." },
  { value: "typed", label: "TYPED ONLY", help: "Never suggest this choice. Typing the input directly still works." },
];

type EditorScreen =
  | { type: "overview" }
  | { type: "response"; outcomeId: string }
  | { type: "input-settings" };

export function aliasesForUserInput(userInputText: string, aliases: string[]) {
  const trimmed = userInputText.trim();
  const values = [trimmed, ...aliases.map((alias) => alias.trim())].filter(Boolean);
  const seen = new Set<string>();
  return values.filter((alias) => {
    const normalized = alias.toLocaleLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function normalizedInteraction(
  initial: Interaction | undefined,
  sourceNodeId: string,
  command: string,
  fallback: boolean,
) {
  const value = structuredClone(initial ?? createDraftInteraction(sourceNodeId, command, fallback));
  value.matchMode ??= fallback ? "fallback" : "command";
  value.choiceVisibility ??= fallback ? "typed" : "prompt";
  value.choiceVisibleWhen ??= ALWAYS;
  value.outcomes = value.outcomes.length ? value.outcomes.map((outcome) => normalizeInteractionOutcomeProse({
    ...outcome,
    authorStatus: outcome.authorStatus ?? "configured",
  })) : [createDraftOutcome()];
  return value;
}

function conditionSummary(condition: Condition): string {
  switch (condition.type) {
    case "always": return "Always";
    case "attempt": {
      if (condition.operator === "eq" && condition.value === 1) return "First time";
      if (condition.operator === "eq" && condition.value === 2) return "Second time";
      if (condition.operator === "gte" && condition.value === 2) return "Second time +";
      return `Attempt ${condition.operator} ${condition.value}`;
    }
    case "variable": return `${condition.key || "variable"} ${condition.operator} ${String(condition.value)}`;
    case "flag": return `${condition.key || "flag"} is ${condition.value ? "true" : "false"}`;
    case "has_item": return `Has item${condition.minimum && condition.minimum > 1 ? ` ×${condition.minimum}` : ""}`;
    case "lacks_item": return "Lacks item";
    case "visited": return condition.value ? "Visited node" : "Has not visited node";
    case "state": return `${condition.field} ${condition.operator} ${condition.value}`;
    case "all": return `All of ${condition.conditions.length} conditions`;
    case "any": return `Any of ${condition.conditions.length} conditions`;
    case "not": return `Not: ${conditionSummary(condition.condition)}`;
  }
}

function responseSnippet(outcome: InteractionOutcome) {
  const prose = interactionOutcomeProse(outcome);
  const text = [prose.narrationText, prose.dialogueText].filter((value) => value.trim()).join(" / ").trim().replace(/\s+/g, " ");
  if (text) return text.length > 72 ? `${text.slice(0, 69)}...` : text;
  if (outcome.effects.length) return `${outcome.effects.length} effect${outcome.effects.length === 1 ? "" : "s"}, no response text`;
  return "No response yet";
}

function responseSpeakerLabel(snapshot: ProjectSnapshot, outcome: InteractionOutcome, conversationCharacterId: string | null) {
  const prose = interactionOutcomeProse(outcome);
  if (!prose.dialogueText.trim()) return "Narration";
  const speakerId = conversationCharacterId ?? outcome.speakerId;
  if (!speakerId) return "Conversation at runtime";
  return snapshot.entities.find((entity) => entity.type === "character" && entity.id === speakerId)?.name ?? "Unknown speaker";
}

function destinationLabel(snapshot: ProjectSnapshot, outcome: InteractionOutcome) {
  if (outcome.disposition === "stay") return "Stay here";
  if (!outcome.destinationNodeId) return "Choose where to go";
  const node = snapshot.nodes.find((candidate) => candidate.id === outcome.destinationNodeId);
  return node ? `Node #${node.nodeNumber}` : "Linked node";
}

function secondaryAliases(wording: string, aliases: string[]) {
  const primary = wording.trim().toLocaleLowerCase();
  return aliases.filter((alias) => alias.trim().toLocaleLowerCase() !== primary);
}

export function InteractionEditor({
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
  const [draft, setDraft] = useState(() => normalizedInteraction(initial, resolvedSourceNodeId, initialCommand, fallbackMode));
  const [newOutcomeIds, setNewOutcomeIds] = useState<Set<string>>(() => new Set());
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(draft));
  const [screen, setScreen] = useState<EditorScreen>(() => initialOutcomeId && draft.outcomes.some((outcome) => outcome.id === initialOutcomeId)
    ? { type: "response", outcomeId: initialOutcomeId }
    : { type: "overview" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const draftSignature = JSON.stringify(draft);
  const captureMode = !fallbackMode && draft.matchMode === "capture";
  const sourceTraversalIndex = playState.traversal.lastIndexOf(draft.sourceNodeId);
  const sourcePlayState = sourceTraversalIndex >= 0
    ? { ...playState, currentNodeId: draft.sourceNodeId, traversal: playState.traversal.slice(0, sourceTraversalIndex + 1) }
    : { ...playState, currentNodeId: draft.sourceNodeId };
  const conversationCharacterId = resolveNodeConversationContext(snapshot, sourcePlayState, draft.sourceNodeId)?.characterId ?? null;

  useEffect(() => {
    onDirtyChange(draftSignature !== savedSignature);
    return () => onDirtyChange(false);
  }, [draftSignature, savedSignature, onDirtyChange]);

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

  const save = async (): Promise<boolean> => {
    const userInputText = draft.wording.trim();
    if (!fallbackMode && !captureMode && !userInputText) {
      setError("Enter user-input-text or choose Capture player input.");
      setScreen({ type: "overview" });
      return false;
    }
    if (captureMode && snapshot.interactions.some((interaction) =>
      interaction.id !== draft.id
      && interaction.sourceNodeId === draft.sourceNodeId
      && interaction.matchMode === "capture")) {
      setError("This node already has a Capture player input interaction. Edit that interaction instead.");
      setScreen({ type: "overview" });
      return false;
    }
    const incompleteTransition = draft.outcomes.find((outcome) => outcome.disposition === "transition" && !outcome.destinationNodeId);
    if (incompleteTransition) {
      setError("Choose an existing destination or create a new Node before saving.");
      setScreen({ type: "response", outcomeId: incompleteTransition.id });
      return false;
    }
    const invalidText = draft.outcomes.find((outcome) =>
      validateTextNotation(outcome.responseText).length
      || validateTextNotation(outcome.dialogueText ?? "").length);
    if (invalidText) {
      setError("Fix the response text rule error before saving.");
      setScreen({ type: "response", outcomeId: invalidText.id });
      return false;
    }
    setError("");
    setSaving(true);
    try {
      const interaction: Interaction = {
        ...draft,
        wording: fallbackMode || captureMode ? "" : userInputText,
        matchMode: fallbackMode ? "fallback" : captureMode ? "capture" : "command",
        choiceVisibility: fallbackMode || captureMode ? "typed" : draft.choiceVisibility,
        choiceVisibleWhen: fallbackMode || captureMode ? ALWAYS : (draft.choiceVisibleWhen ?? ALWAYS),
        aliases: fallbackMode || captureMode ? [] : aliasesForUserInput(userInputText, draft.aliases),
        outcomes: draft.outcomes.map((outcome, index) => ({ ...outcome, order: index })),
      };
      const result = await onSave(
        [{ type: "interaction.upsert", interaction }],
        fallbackMode
          ? `${initial ? "Changed" : "Created"} invalid-input response for node ${snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}`
          : captureMode
            ? `${initial ? "Changed" : "Created"} player-input capture for node ${snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}`
            : initial ? `Changed user input ${interaction.wording}` : `Created user input ${interaction.wording}`,
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

  const selectedOutcome = "outcomeId" in screen
    ? draft.outcomes.find((outcome) => outcome.id === screen.outcomeId)
    : undefined;

  const back = () => {
    setError("");
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
        autoFocusWording={!initial}
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
        autoFocusText={!initial || newOutcomeIds.has(selectedOutcome.id)}
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

    <div className="author-actions author-panel-footer guided-editor-footer">
      <button type="button" onClick={() => void save()} disabled={saving}>[{saving ? "SAVING..." : "SAVE"}]</button>
      {screen.type === "overview" && initial ? confirmDelete ? <>
        <span>Delete this {fallbackMode ? "invalid-input response" : captureMode ? "player-input capture" : "user input"}?</span>
        <button type="button" onClick={() => void onSave([{ type: "interaction.delete", id: initial.id }], fallbackMode ? "Deleted invalid-input response" : captureMode ? "Deleted player-input capture" : `Deleted user input ${initial.wording || initial.aliases[0]}`)}>[CONFIRM DELETE]</button>
        <button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button>
      </> : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE INPUT]</button> : null}
    </div>
  </section>;
}

function InteractionOverview({
  draft,
  fallbackMode,
  captureMode,
  snapshot,
  conversationCharacterId,
  notationForOutcome,
  autoFocusWording,
  onWording,
  onMatchMode,
  onOpenResponse,
  onAddResponse,
  onOpenSettings,
}: {
  draft: Interaction;
  fallbackMode: boolean;
  captureMode: boolean;
  snapshot: ProjectSnapshot;
  conversationCharacterId: string | null;
  notationForOutcome: (outcome: InteractionOutcome) => string;
  autoFocusWording: boolean;
  onWording: (wording: string) => void;
  onMatchMode: (matchMode: "command" | "capture") => void;
  onOpenResponse: (outcomeId: string) => void;
  onAddResponse: () => void;
  onOpenSettings: () => void;
}) {
  return <div className="interaction-overview">
    {!fallbackMode ? <section className="guided-section interaction-primary-section">
      <h3>PLAYER INPUT</h3>
      {!captureMode ? <label className="user-input-field">PLAYER ENTERS
        <input value={draft.wording} onChange={(event) => onWording(event.target.value)} autoFocus={autoFocusWording} enterKeyHint="done" />
      </label> : <div className="guided-context-copy compact-copy">Accept otherwise-unmatched text at this Node and make it available to response effects.</div>}
      <div className="interaction-mode-row" aria-label="Player input mode">
        <span>MODE</span>
        <button type="button" aria-pressed={!captureMode} onClick={() => onMatchMode("command")}>{!captureMode ? "[X]" : "[ ]"} SPECIFIC</button>
        <button type="button" aria-pressed={captureMode} onClick={() => onMatchMode("capture")}>{captureMode ? "[X]" : "[ ]"} CAPTURE</button>
      </div>
    </section> : <div className="guided-context-copy compact-copy">Response used when player text does not match another valid input at this Node.</div>}

    <section className="guided-section interaction-response-section">
      <h3>RESPONSES</h3>
      <div className="response-summary-list">
        {draft.outcomes.map((outcome, index) => <button type="button" className="response-summary-row" key={outcome.id} onClick={() => onOpenResponse(outcome.id)}>
          <span className={`response-summary-notation${outcome.authorStatus === "draft" ? " draft-input" : ""}`}>{notationForOutcome(outcome)}</span>
          <span className="response-summary-content">
            <strong>{index + 1}. {responseSnippet(outcome)}</strong>
            <small>{responseSpeakerLabel(snapshot, outcome, conversationCharacterId)} · {conditionSummary(outcome.condition)} · {destinationLabel(snapshot, outcome)} · {outcome.effects.length} effect{outcome.effects.length === 1 ? "" : "s"}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>)}
      </div>
      <button type="button" className="guided-add" onClick={onAddResponse}>[+ ADD RESPONSE]</button>
    </section>

    <section className="guided-section interaction-settings-summary">
      <button type="button" className="guided-drill-row" onClick={onOpenSettings}>
        <span>INPUT SETTINGS</span>
        <span className="guided-row-value">{fallbackMode || captureMode ? "Author details" : "Aliases · visibility · details"}</span>
        <span aria-hidden="true">›</span>
      </button>
    </section>
  </div>;
}

function InputSettings({ draft, fallbackMode, captureMode, snapshot, onChange }: {
  draft: Interaction;
  fallbackMode: boolean;
  captureMode: boolean;
  snapshot: ProjectSnapshot;
  onChange: (interaction: Interaction) => void;
}) {
  const aliases = secondaryAliases(draft.wording, draft.aliases);
  const choiceVisibleWhen = draft.choiceVisibleWhen ?? ALWAYS;
  return <div className="guided-subworkspace">
    {!fallbackMode && !captureMode ? <>
      <section className="guided-section">
        <h3>PLAYER VISIBILITY</h3>
        <OutcomeComposerSection title="SHOW CHOICE WHEN" summary={conditionSummary(choiceVisibleWhen)}>
          <p className="guided-context-copy">Controls whether this input is suggested to the player. Typing the input directly still works.</p>
          <ConditionEditor
            condition={choiceVisibleWhen}
            snapshot={snapshot}
            onChange={(condition) => onChange({ ...draft, choiceVisibleWhen: condition })}
          />
        </OutcomeComposerSection>
        <h4>HOW IT IS SHOWN</h4>
        <div className="guided-option-list">{revealOptions.map((option) => <button
          type="button"
          key={option.value}
          aria-pressed={draft.choiceVisibility === option.value}
          className="guided-option-row"
          onClick={() => onChange({ ...draft, choiceVisibility: option.value })}
        >
          <span>{draft.choiceVisibility === option.value ? "[X]" : "[ ]"} {option.label}</span>
          <small>{option.help}</small>
        </button>)}</div>
      </section>
      <section className="guided-section">
        <h3>OTHER WORDING</h3>
        <label>ALTERNATE PHRASES
          <textarea rows={4} value={aliases.join("\n")} placeholder="one alternate phrase per line" onChange={(event) => {
            const other = event.target.value.split("\n");
            onChange({ ...draft, aliases: [draft.wording, ...other] });
          }} />
        </label>
      </section>
    </> : null}
    <section className="guided-section">
      <h3>AUTHOR DETAILS</h3>
      <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => onChange({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
      <label>AUTHOR NOTE <textarea rows={3} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></label>
    </section>
  </div>;
}

function ResponseWorkspace({ outcome, snapshot, playState, index, total, notation, autoFocusText, conversationCharacterId, onPreview, onCreateDestination, onEditDestination, onChange, onMove, onRemove }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  index: number;
  total: number;
  notation: string;
  autoFocusText: boolean;
  conversationCharacterId: string | null;
  onPreview?: (value: AuthoredTextValue, speakerId: string | null) => void;
  onCreateDestination?: () => void;
  onEditDestination?: (nodeId: string) => void;
  onChange: (change: (outcome: InteractionOutcome) => InteractionOutcome) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const prose = interactionOutcomeProse(outcome);
  const dialogueSpeakerId = conversationCharacterId ?? outcome.speakerId ?? null;
  const dialogueSpeakerName = dialogueSpeakerId
    ? snapshot.entities.find((entity) => entity.type === "character" && entity.id === dialogueSpeakerId)?.name ?? "Unknown character"
    : "";
  const showDialogueEditor = Boolean(conversationCharacterId || outcome.speakerId || prose.dialogueText.trim());
  const dialogueLabel = dialogueSpeakerName
    ? `${dialogueSpeakerName.toUpperCase()} SAYS`
    : "DIALOGUE — CHOOSE SPEAKER";

  return <div className="guided-subworkspace response-workspace">
    <div className="guided-response-status"><span className={outcome.authorStatus === "draft" ? "draft-input" : ""}>{notation}</span><span>Response {index + 1} of {total}</span></div>
    <section className="response-writing-section">
      {!conversationCharacterId ? <label>SPEAKER
        <ReferenceField
          kind="character"
          value={outcome.speakerId ?? ""}
          onChange={(speakerId) => onChange((current) => ({ ...current, speakerId: speakerId || null }))}
          placeholder="none / narration"
        />
        <small>Optional outside a conversation. In an active conversation, the Node's conversation character is used automatically.</small>
      </label> : null}
      <div className={`narrative-prose-grid${showDialogueEditor ? " has-dialogue" : ""}`}>
        <AuthoredTextEditor
          value={{ text: prose.narrationText, performance: prose.narrationPerformance }}
          snapshot={snapshot}
          playState={playState}
          label="NARRATION"
          rows={4}
          autoFocus={autoFocusText && !dialogueSpeakerId}
          onChange={(value) => onChange((current) => ({
            ...current,
            responseText: value.text,
            responsePerformance: value.performance,
          }))}
          onPreview={onPreview ? (value) => onPreview(value, null) : undefined}
        />
        {showDialogueEditor ? <AuthoredTextEditor
          value={{ text: prose.dialogueText, performance: prose.dialoguePerformance }}
          snapshot={snapshot}
          playState={playState}
          label={dialogueLabel}
          rows={4}
          autoFocus={autoFocusText && Boolean(dialogueSpeakerId)}
          onChange={(value) => onChange((current) => ({
            ...current,
            dialogueText: value.text,
            dialoguePerformance: value.performance,
          }))}
          onPreview={onPreview ? (value) => onPreview(value, dialogueSpeakerId) : undefined}
        /> : null}
      </div>
    </section>
    <div className="interaction-outcome-composer" aria-label="Complete response outcome">
      <OutcomeComposerSection title="WHEN" summary={conditionSummary(outcome.condition)}>
        <OutcomeConditionEditor condition={outcome.condition} snapshot={snapshot} onChange={(condition) => onChange((current) => ({ ...current, condition }))} />
      </OutcomeComposerSection>
      <OutcomeComposerSection title="AFTER" summary={destinationLabel(snapshot, outcome)}>
        <AfterWorkspace
          outcome={outcome}
          snapshot={snapshot}
          playState={playState}
          onCreateDestination={onCreateDestination}
          onEditDestination={onEditDestination}
          onChange={onChange}
        />
      </OutcomeComposerSection>
      <OutcomeComposerSection title="EFFECTS" summary={outcome.effects.length ? `${outcome.effects.length} configured` : "None"}>
        <OutcomeEffectsEditor effects={outcome.effects} snapshot={snapshot} onChange={(effects) => onChange((current) => ({ ...current, effects }))} />
      </OutcomeComposerSection>
      <OutcomeComposerSection title="AUTHOR DETAILS" summary={outcome.label.trim() || "Optional label"}>
        <p className="guided-context-copy">Private organization for this response. It is never shown to the player.</p>
        <label>RESPONSE LABEL <input value={outcome.label} placeholder="optional private label" onChange={(event) => onChange((current) => ({ ...current, label: event.target.value }))} /></label>
      </OutcomeComposerSection>
    </div>
    <div className="guided-response-actions">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>[MOVE UP]</button>
      <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>[MOVE DOWN]</button>
      {onRemove ? <button type="button" onClick={onRemove}>[REMOVE RESPONSE]</button> : null}
    </div>
  </div>;
}

function AfterWorkspace({ outcome, snapshot, playState, onCreateDestination, onEditDestination, onChange }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  onCreateDestination?: () => void;
  onEditDestination?: (nodeId: string) => void;
  onChange: (change: (outcome: InteractionOutcome) => InteractionOutcome) => void;
}) {
  const [existingNodeQuery, setExistingNodeQuery] = useState("");
  const documents = useMemo(() => buildSearchIndex(snapshot), [snapshot]);
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const matches = useMemo(
    () => searchProject(snapshot, documents, playState, existingNodeQuery, ["node"], 12),
    [snapshot, documents, playState, existingNodeQuery],
  );
  const destinationNotation = outcome.destinationNodeId
    ? notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, outcome.destinationNodeId).join("") || "[A1]"
    : "[D]";
  const destination = snapshot.nodes.find((node) => node.id === outcome.destinationNodeId);
  const selected = outcome.disposition === "stay" ? "stay" : "existing";

  const choose = (value: string) => {
    if (value === "stay") {
      setExistingNodeQuery("");
      onChange((current) => ({ ...current, disposition: "stay", destinationNodeId: null }));
      return;
    }
    if (value === "create") {
      onCreateDestination?.();
      return;
    }
    onChange((current) => ({ ...current, disposition: "transition" }));
  };

  const existingResults = <>
    {outcome.destinationNodeId ? <div className="selected-destination">
      <span>LINKED {destinationNotation}: {destination?.text ?? outcome.destinationNodeId}</span>
      <span className="selected-destination-actions">
        {onEditDestination ? <button type="button" onClick={() => onEditDestination(outcome.destinationNodeId!)}>[EDIT NODE]</button> : null}
        <button type="button" onClick={() => onChange((current) => ({ ...current, destinationNodeId: null }))}>[UNLINK]</button>
      </span>
    </div> : null}
    {existingNodeQuery.trim() ? <div className="search-strip guided-destination-results" role="listbox" aria-label="Existing destination matches">
      {matches.length ? matches.map((result) => <div className="guided-destination-result" key={result.id}>
        <button type="button" role="option" className="guided-destination-select" onClick={() => {
          setExistingNodeQuery("");
          onChange((current) => ({ ...current, disposition: "transition", destinationNodeId: result.id }));
        }}><span>{result.label}</span><span>{result.notation.join("")}</span></button>
        {onEditDestination ? <button type="button" className="guided-destination-edit" onClick={() => onEditDestination(result.id)}>[EDIT]</button> : null}
      </div>) : <span className="search-empty">No existing node matches this search.</span>}
    </div> : null}
  </>;

  return <AuthorUiBlocks blocks={[{
    type: "choice",
    id: `after-${outcome.id}`,
    label: "What happens after this response?",
    labelMode: "sr-only",
    value: selected,
    onChange: choose,
    presentation: "segmented",
    options: [
      {
        value: "stay",
        label: "STAY HERE",
        help: "Keep the player at the current node.",
      },
      {
        value: "create",
        label: "CREATE NEW",
        help: "Open the real Node editor. Saving that nested task returns here with the new Node linked.",
      },
      {
        value: "existing",
        label: "LINK EXISTING",
        help: "Connect this response to a Node that already exists.",
        content: [
          {
            type: "field",
            id: `existing-destination-${outcome.id}`,
            label: "Find existing node",
            labelMode: "sr-only",
            control: "search",
            value: existingNodeQuery,
            onChange: setExistingNodeQuery,
            placeholder: "Find an existing node…",
            inputMode: "search",
          },
          { type: "custom", id: `existing-results-${outcome.id}`, role: "results", content: existingResults },
        ],
      },
    ],
  }]} />;
}
