import { useEffect, useMemo, useState } from "react";
import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { buildSearchIndex, searchProject } from "../../../author/search/projectSearch";
import type { Condition } from "../../../engine/rules/model";
import type {
  MutationOperation,
  PlayState,
  ProjectSnapshot,
} from "../../../engine/project/model";
import { makeId } from "../../../engine/project/id";
import { nextNodeNumber } from "../nodeNumber";
import type {
  GameNode,
  Interaction,
  InteractionChoiceVisibility,
  InteractionOutcome,
} from "../model";
import { ConditionEditor } from "../../../author/ConditionEditor";
import { EffectsEditor } from "../../../author/EffectsEditor";
import { createDraftInteraction, createDraftOutcome } from "../drafts";
import { buildGraphIndex, notationForNode } from "../graph";
import { AuthoredTextEditor, type AuthoredTextValue } from "./AuthoredTextEditor";
import { validateTextNotation } from "../textNotation";
import "./interactionEditor.css";

const revealOptions: Array<{ value: InteractionChoiceVisibility; label: string; help: string }> = [
  { value: "immediate", label: "VISIBLE", help: "Show this choice without opening the prompt menu." },
  { value: "prompt", label: "ON PROMPT", help: "Show this choice when the player opens available options." },
  { value: "typed", label: "TYPED ONLY", help: "Accept the command when typed without showing it as a player choice." },
];

type EditorScreen =
  | { type: "overview" }
  | { type: "response"; outcomeId: string }
  | { type: "when"; outcomeId: string }
  | { type: "after"; outcomeId: string }
  | { type: "effects"; outcomeId: string }
  | { type: "author-details"; outcomeId: string }
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
  defaultSpeakerId: string | null,
) {
  const creating = !initial;
  const value = structuredClone(initial ?? createDraftInteraction(sourceNodeId, command, fallback));
  value.matchMode ??= fallback ? "fallback" : "command";
  value.choiceVisibility ??= fallback ? "typed" : "prompt";
  value.outcomes = value.outcomes.length ? value.outcomes.map((outcome) => ({
    ...outcome,
    authorStatus: outcome.authorStatus ?? "configured",
    speakerId: outcome.speakerId ?? (creating ? defaultSpeakerId : null),
    responsePerformance: outcome.responsePerformance ?? { charactersPerSecond: 18, cues: [] },
  })) : [{ ...createDraftOutcome(), speakerId: defaultSpeakerId }];
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
  const text = outcome.responseText.trim().replace(/\s+/g, " ");
  if (text) return text.length > 72 ? `${text.slice(0, 69)}...` : text;
  if (outcome.effects.length) return `${outcome.effects.length} effect${outcome.effects.length === 1 ? "" : "s"}, no response text`;
  return "No response yet";
}

function responseSpeakerLabel(snapshot: ProjectSnapshot, outcome: InteractionOutcome) {
  if (!outcome.speakerId) return "Narration";
  return snapshot.entities.find((entity) => entity.type === "character" && entity.id === outcome.speakerId)?.name ?? "Unknown speaker";
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
  initial,
  initialCommand = "",
  fallback = false,
  onSave,
  onCancel,
  onDirtyChange,
  onPreview,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  initial?: Interaction;
  initialCommand?: string;
  fallback?: boolean;
  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onPreview?: (outcome: InteractionOutcome) => void;
}) {
  const fallbackMode = fallback || initial?.matchMode === "fallback";
  const sourceSpeakerId = snapshot.nodes.find((node) => node.id === playState.currentNodeId)?.characterId ?? null;
  const [draft, setDraft] = useState(() => normalizedInteraction(initial, playState.currentNodeId, initialCommand, fallbackMode, sourceSpeakerId));
  const [newNodeText, setNewNodeText] = useState<Record<string, string>>({});
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify({ draft, newNodeText: {} }));
  const [screen, setScreen] = useState<EditorScreen>({ type: "overview" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const draftSignature = JSON.stringify({ draft, newNodeText });

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
    const outcome = { ...createDraftOutcome(draft.outcomes.length), speakerId: sourceSpeakerId };
    setDraft((current) => ({ ...current, outcomes: [...current.outcomes, outcome] }));
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
    setScreen({ type: "overview" });
  };

  const notationForOutcome = (outcome: InteractionOutcome) => {
    if (outcome.authorStatus === "draft") return "[D]";
    if (outcome.disposition === "stay" || !outcome.destinationNodeId) return "[H]";
    return notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, outcome.destinationNodeId).join("") || "[A1]";
  };

  const save = async () => {
    const userInputText = draft.wording.trim();
    if (!fallbackMode && !userInputText) {
      setError("Enter user-input-text.");
      setScreen({ type: "overview" });
      return;
    }
    const incompleteTransition = draft.outcomes.find((outcome) =>
      outcome.disposition === "transition" && !outcome.destinationNodeId && !newNodeText[outcome.id]?.trim(),
    );
    if (incompleteTransition) {
      setError("Choose an existing destination or write the text for a new node.");
      setScreen({ type: "after", outcomeId: incompleteTransition.id });
      return;
    }
    const invalidText = draft.outcomes.find((outcome) => validateTextNotation(outcome.responseText).length);
    if (invalidText) {
      setError("Fix the response text rule error before saving.");
      setScreen({ type: "response", outcomeId: invalidText.id });
      return;
    }
    setError("");
    setSaving(true);
    try {
      let nodeNumber = nextNodeNumber(snapshot);
      const createdNodes: GameNode[] = [];
      const interaction: Interaction = {
        ...draft,
        wording: fallbackMode ? "" : userInputText,
        matchMode: fallbackMode ? "fallback" : "command",
        choiceVisibility: fallbackMode ? "typed" : draft.choiceVisibility,
        aliases: fallbackMode ? [] : aliasesForUserInput(userInputText, draft.aliases),
        outcomes: draft.outcomes.map((outcome, index) => {
          const text = newNodeText[outcome.id]?.trim();
          if (outcome.disposition !== "transition" || outcome.destinationNodeId || !text) {
            return { ...outcome, order: index };
          }
          const node: GameNode = {
            id: makeId(),
            nodeNumber: nodeNumber++,
            text,
            ending: false,
            tags: [],
            characterId: null,
            locationId: null,
            performance: { charactersPerSecond: 18, cues: [] },
          };
          createdNodes.push(node);
          return { ...outcome, order: index, destinationNodeId: node.id };
        }),
      };
      const result = await onSave(
        [
          ...createdNodes.map((node): MutationOperation => ({ type: "node.upsert", node })),
          { type: "interaction.upsert", interaction },
        ],
        fallbackMode
          ? `${initial ? "Changed" : "Created"} invalid-input response for node ${snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}`
          : initial ? `Changed user input ${interaction.wording}` : `Created user input ${interaction.wording}`,
      );
      if (result.status === "saved" || result.status === "queued") {
        setDraft(interaction);
        setNewNodeText({});
        setSavedSignature(JSON.stringify({ draft: interaction, newNodeText: {} }));
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedOutcome = "outcomeId" in screen
    ? draft.outcomes.find((outcome) => outcome.id === screen.outcomeId)
    : undefined;

  const back = () => {
    setError("");
    if (screen.type === "response" || screen.type === "input-settings") setScreen({ type: "overview" });
    else if ("outcomeId" in screen) setScreen({ type: "response", outcomeId: screen.outcomeId });
  };

  const title = screen.type === "overview"
    ? fallbackMode ? "INVALID INPUT" : (draft.wording.trim() || "NEW USER INPUT").toUpperCase()
    : screen.type === "input-settings" ? "INPUT SETTINGS"
    : screen.type === "response" ? `RESPONSE ${Math.max(1, draft.outcomes.findIndex((outcome) => outcome.id === screen.outcomeId) + 1)}`
    : screen.type === "author-details" ? "AUTHOR DETAILS"
    : screen.type.toUpperCase();

  return <section className="author-panel author-panel-frame interaction-editor-panel guided-interaction-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header className="guided-editor-header">
      {screen.type !== "overview" ? <button type="button" className="guided-back" onClick={back} aria-label="Back">[‹]</button> : null}
      <span>{title}</span>
      <small>#{snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}</small>
    </header>

    <div className="author-panel-body guided-editor-body">
      {screen.type === "overview" ? <InteractionOverview
        draft={draft}
        fallbackMode={fallbackMode}
        snapshot={snapshot}
        notationForOutcome={notationForOutcome}
        onWording={(wording) => setDraft({ ...draft, wording })}
        onOpenResponse={(outcomeId) => setScreen({ type: "response", outcomeId })}
        onAddResponse={addResponseDraft}
        onOpenSettings={() => setScreen({ type: "input-settings" })}
      /> : null}

      {screen.type === "input-settings" ? <InputSettings
        draft={draft}
        fallbackMode={fallbackMode}
        onChange={setDraft}
      /> : null}

      {screen.type === "response" && selectedOutcome ? <ResponseWorkspace
        outcome={selectedOutcome}
        snapshot={snapshot}
        index={draft.outcomes.findIndex((outcome) => outcome.id === selectedOutcome.id)}
        total={draft.outcomes.length}
        notation={notationForOutcome(selectedOutcome)}
        onText={(responseText) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, responseText }))}
        onPerformance={(responsePerformance) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, responsePerformance }))}
        onSpeaker={(speakerId) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, speakerId }))}
        onPreview={onPreview ? () => onPreview(selectedOutcome) : undefined}
        onOpen={(type) => setScreen({ type, outcomeId: selectedOutcome.id })}
        onMove={(direction) => moveOutcome(selectedOutcome.id, direction)}
        onRemove={draft.outcomes.length > 1 ? () => removeOutcome(selectedOutcome.id) : undefined}
      /> : null}

      {screen.type === "when" && selectedOutcome ? <WhenWorkspace
        outcome={selectedOutcome}
        snapshot={snapshot}
        onChange={(condition) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, condition }))}
      /> : null}

      {screen.type === "after" && selectedOutcome ? <AfterWorkspace
        outcome={selectedOutcome}
        snapshot={snapshot}
        playState={playState}
        newNodeText={newNodeText[selectedOutcome.id] ?? ""}
        onNewNodeText={(text) => setNewNodeText((current) => ({ ...current, [selectedOutcome.id]: text }))}
        onChange={(change) => configureOutcome(selectedOutcome.id, change)}
      /> : null}

      {screen.type === "effects" && selectedOutcome ? <EffectsWorkspace
        outcome={selectedOutcome}
        snapshot={snapshot}
        onChange={(effects) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, effects }))}
      /> : null}

      {screen.type === "author-details" && selectedOutcome ? <ResponseAuthorDetailsWorkspace
        outcome={selectedOutcome}
        onChange={(change) => configureOutcome(selectedOutcome.id, change)}
      /> : null}

      {error ? <div className="author-message guided-editor-error" role="alert">{error}</div> : null}
    </div>

    <div className="author-actions author-panel-footer guided-editor-footer">
      <button type="button" onClick={() => void save()} disabled={saving}>[{saving ? "SAVING..." : "SAVE & TRY"}]</button>
      <button type="button" onClick={onCancel}>[CANCEL]</button>
      {screen.type === "overview" && initial ? confirmDelete ? <>
        <span>Delete this {fallbackMode ? "invalid-input response" : "user input"}?</span>
        <button type="button" onClick={() => void onSave([{ type: "interaction.delete", id: initial.id }], fallbackMode ? "Deleted invalid-input response" : `Deleted user input ${initial.wording || initial.aliases[0]}`)}>[CONFIRM DELETE]</button>
        <button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button>
      </> : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE INPUT]</button> : null}
    </div>
  </section>;
}

function InteractionOverview({
  draft,
  fallbackMode,
  snapshot,
  notationForOutcome,
  onWording,
  onOpenResponse,
  onAddResponse,
  onOpenSettings,
}: {
  draft: Interaction;
  fallbackMode: boolean;
  snapshot: ProjectSnapshot;
  notationForOutcome: (outcome: InteractionOutcome) => string;
  onWording: (wording: string) => void;
  onOpenResponse: (outcomeId: string) => void;
  onAddResponse: () => void;
  onOpenSettings: () => void;
}) {
  return <div className="interaction-overview">
    {!fallbackMode ? <label className="user-input-field">PLAYER ENTERS
      <input value={draft.wording} onChange={(event) => onWording(event.target.value)} autoFocus={!draft.wording.trim()} enterKeyHint="done" />
    </label> : <div className="guided-context-copy">This is what can happen when the player's text does not match any valid input at this node.</div>}

    <section className="guided-section">
      <h3>WHAT CAN HAPPEN?</h3>
      <div className="response-summary-list">
        {draft.outcomes.map((outcome, index) => <button type="button" className="response-summary-row" key={outcome.id} onClick={() => onOpenResponse(outcome.id)}>
          <span className={`response-summary-notation${outcome.authorStatus === "draft" ? " draft-input" : ""}`}>{notationForOutcome(outcome)}</span>
          <span className="response-summary-content">
            <strong>{index + 1}. {responseSnippet(outcome)}</strong>
            <small>SPEAKER: {responseSpeakerLabel(snapshot, outcome)} · WHEN: {conditionSummary(outcome.condition)} · AFTER: {destinationLabel(snapshot, outcome)} · {outcome.effects.length} effect{outcome.effects.length === 1 ? "" : "s"}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>)}
      </div>
      <button type="button" className="guided-add" onClick={onAddResponse}>[+ ADD RESPONSE]</button>
    </section>

    <section className="guided-section">
      <h3>INPUT SETTINGS</h3>
      <button type="button" className="guided-drill-row" onClick={onOpenSettings}>
        <span>{fallbackMode ? "Author details" : "Aliases, visibility, author details"}</span>
        <span aria-hidden="true">›</span>
      </button>
    </section>
  </div>;
}

function InputSettings({ draft, fallbackMode, onChange }: {
  draft: Interaction;
  fallbackMode: boolean;
  onChange: (interaction: Interaction) => void;
}) {
  const aliases = secondaryAliases(draft.wording, draft.aliases);
  return <div className="guided-subworkspace">
    {!fallbackMode ? <>
      <section className="guided-section">
        <h3>PLAYER VISIBILITY</h3>
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

function ResponseWorkspace({ outcome, snapshot, index, total, notation, onText, onPerformance, onSpeaker, onPreview, onOpen, onMove, onRemove }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  index: number;
  total: number;
  notation: string;
  onText: (text: string) => void;
  onPerformance: (performance: InteractionOutcome["responsePerformance"]) => void;
  onSpeaker: (speakerId: string | null) => void;
  onPreview?: () => void;
  onOpen: (screen: "when" | "after" | "effects" | "author-details") => void;
  onMove: (direction: -1 | 1) => void;
  onRemove?: () => void;
}) {
  return <div className="guided-subworkspace response-workspace">
    <div className="guided-response-status"><span className={outcome.authorStatus === "draft" ? "draft-input" : ""}>{notation}</span><span>Response {index + 1} of {total}</span></div>
    <section className="guided-section response-writing-section">
      <h3>RESPONSE</h3>
      <label>SPEAKER
        <ReferenceField
          kind="character"
          value={outcome.speakerId ?? ""}
          onChange={(speakerId) => onSpeaker(speakerId || null)}
          placeholder="none / narration"
        />
        <small>The selected character's name is shown with this response in play.</small>
      </label>
      <AuthoredTextEditor
        value={{ text: outcome.responseText, performance: outcome.responsePerformance }}
        snapshot={snapshot}
        label={`RESPONSE TEXT ${index + 1}`}
        rows={5}
        autoFocus
        onChange={(value: AuthoredTextValue) => {
          onText(value.text);
          onPerformance(value.performance);
        }}
        onPreview={onPreview ? () => onPreview() : undefined}
      />
    </section>
    <section className="guided-section guided-drill-list">
      <button type="button" className="guided-drill-row" onClick={() => onOpen("when")}><span>WHEN</span><span className="guided-row-value">{conditionSummary(outcome.condition)}</span><span>›</span></button>
      <button type="button" className="guided-drill-row" onClick={() => onOpen("after")}><span>AFTER</span><span className="guided-row-value">{destinationLabel(snapshot, outcome)}</span><span>›</span></button>
      <button type="button" className="guided-drill-row" onClick={() => onOpen("effects")}><span>EFFECTS</span><span className="guided-row-value">{outcome.effects.length || "None"}</span><span>›</span></button>
      <button type="button" className="guided-drill-row" onClick={() => onOpen("author-details")}><span>AUTHOR DETAILS</span><span className="guided-row-value">{outcome.label.trim() || "Optional label"}</span><span>›</span></button>
    </section>
    <div className="guided-response-actions">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>[MOVE UP]</button>
      <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>[MOVE DOWN]</button>
      {onRemove ? <button type="button" onClick={onRemove}>[REMOVE RESPONSE]</button> : null}
    </div>
  </div>;
}

function WhenWorkspace({ outcome, snapshot, onChange }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  onChange: (condition: Condition) => void;
}) {
  return <div className="guided-subworkspace">
    <section className="guided-section">
      <h3>WHEN SHOULD THIS RESPONSE HAPPEN?</h3>
      <div className="attempt-presets guided-presets">
        <button type="button" onClick={() => onChange({ type: "always" })}>[ALWAYS]</button>
        <button type="button" onClick={() => onChange({ type: "attempt", operator: "eq", value: 1 })}>[FIRST TIME]</button>
        <button type="button" onClick={() => onChange({ type: "attempt", operator: "eq", value: 2 })}>[SECOND TIME]</button>
        <button type="button" onClick={() => onChange({ type: "attempt", operator: "gte", value: 2 })}>[SECOND+]</button>
      </div>
      <ConditionEditor condition={outcome.condition} onChange={onChange} snapshot={snapshot} />
    </section>
  </div>;
}

function AfterWorkspace({ outcome, snapshot, playState, newNodeText, onNewNodeText, onChange }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  newNodeText: string;
  onNewNodeText: (text: string) => void;
  onChange: (change: (outcome: InteractionOutcome) => InteractionOutcome) => void;
}) {
  const documents = useMemo(() => buildSearchIndex(snapshot), [snapshot]);
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const matches = useMemo(
    () => searchProject(snapshot, documents, playState, newNodeText, ["node"], 12),
    [snapshot, documents, playState, newNodeText],
  );
  const destinationNotation = outcome.destinationNodeId
    ? notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, outcome.destinationNodeId).join("") || "[A1]"
    : "[D]";
  const destination = snapshot.nodes.find((node) => node.id === outcome.destinationNodeId);

  return <div className="guided-subworkspace">
    <section className="guided-section">
      <h3>WHAT HAPPENS AFTER THIS RESPONSE?</h3>
      <div className="guided-option-list">
        <button type="button" className="guided-option-row" aria-pressed={outcome.disposition === "stay"} onClick={() => onChange((current) => ({ ...current, disposition: "stay", destinationNodeId: null }))}>
          <span>{outcome.disposition === "stay" ? "[X]" : "[ ]"} STAY HERE</span><small>Keep the player at the current node.</small>
        </button>
        <button type="button" className="guided-option-row" aria-pressed={outcome.disposition === "transition"} onClick={() => onChange((current) => ({ ...current, disposition: "transition" }))}>
          <span>{outcome.disposition === "transition" ? "[X]" : "[ ]"} GO SOMEWHERE ELSE</span><small>Continue to another existing or new node.</small>
        </button>
      </div>
    </section>

    {outcome.disposition === "transition" ? <section className="guided-section destination-editor">
      <h3>DESTINATION</h3>
      {outcome.destinationNodeId ? <div className="selected-destination">
        <span>LINKED {destinationNotation}: {destination?.text ?? outcome.destinationNodeId}</span>
        <button type="button" onClick={() => onChange((current) => ({ ...current, destinationNodeId: null }))}>[UNLINK]</button>
      </div> : null}
      <label>FIND AN EXISTING NODE OR WRITE A NEW NODE
        <textarea rows={4} value={newNodeText} onChange={(event) => onNewNodeText(event.target.value)} placeholder="Type the text that should appear next; matching existing nodes appear below." />
      </label>
      {newNodeText.trim() && !outcome.destinationNodeId ? <div className="search-strip guided-destination-results" role="listbox" aria-label="Existing destination matches">
        {matches.length ? matches.map((result) => <button type="button" role="option" key={result.id} onClick={() => {
          onChange((current) => ({ ...current, destinationNodeId: result.id }));
          onNewNodeText("");
        }}><span>{result.label}</span><span>{result.notation.join("")}</span></button>) : <span className="search-empty">No existing match. Saving will create this as a new node.</span>}
      </div> : null}
    </section> : null}
  </div>;
}

function EffectsWorkspace({ outcome, snapshot, onChange }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  onChange: (effects: InteractionOutcome["effects"]) => void;
}) {
  return <div className="guided-subworkspace">
    <section className="guided-section">
      <h3>EFFECTS — RUN TOP TO BOTTOM</h3>
      <EffectsEditor effects={outcome.effects} onChange={onChange} snapshot={snapshot} />
    </section>
  </div>;
}

function ResponseAuthorDetailsWorkspace({ outcome, onChange }: {
  outcome: InteractionOutcome;
  onChange: (change: (outcome: InteractionOutcome) => InteractionOutcome) => void;
}) {
  return <div className="guided-subworkspace">
    <section className="guided-section">
      <h3>AUTHOR DETAILS</h3>
      <p className="guided-context-copy">Optional private organization for this response. It is not shown to the player and does not affect response selection.</p>
      <label>RESPONSE LABEL <input value={outcome.label} placeholder="optional private label" onChange={(event) => onChange((current) => ({ ...current, label: event.target.value }))} /></label>
    </section>
  </div>;
}
