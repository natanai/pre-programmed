import { useMemo, useRef, useState, type RefObject } from "react";
import { buildGraphIndex, notationForNode } from "../game/graph";
import {
  ALWAYS,
  makeId,
  nextNodeNumber,
  type GameNode,
  type Interaction,
  type InteractionChoiceVisibility,
  type InteractionOutcome,
  type MutationOperation,
  type PlayState,
  type ProjectSnapshot,
} from "../game/model";
import { buildSearchIndex, searchProject } from "../game/search";
import { ConditionEditor, EffectsEditor, ValueMentionField } from "./AuthorFields";

const revealOptions: Array<{ value: InteractionChoiceVisibility; label: string; help: string }> = [
  { value: "immediate", label: "VISIBLE", help: "Visible immediately." },
  { value: "prompt", label: "ON PROMPT", help: "Revealed from the prompt." },
  { value: "typed", label: "TYPED", help: "Typing only." },
];

function emptyOutcome(order = 0, responseText = ""): InteractionOutcome {
  return {
    id: makeId(),
    order,
    label: order === 0 ? "default" : `response ${order + 1}`,
    authorStatus: "draft",
    condition: ALWAYS,
    responseText,
    responseCharactersPerSecond: 18,
    effects: [],
    disposition: "stay",
    destinationNodeId: null,
  };
}

function emptyInteraction(sourceNodeId: string, command = "", fallback = false): Interaction {
  return {
    id: makeId(),
    sourceNodeId,
    wording: fallback ? "" : command,
    matchMode: fallback ? "fallback" : "command",
    choiceVisibility: fallback ? "typed" : "prompt",
    aliases: fallback ? [] : command ? [command] : [],
    tags: [],
    notes: "",
    outcomes: [emptyOutcome()],
  };
}

export function aliasesForUserInput(userInputText: string, aliases: string[]) {
  const trimmed = userInputText.trim();
  const values = [trimmed, ...aliases.map((alias) => alias.trim())].filter(Boolean);
  const seen = new Set<string>();
  return values.filter((alias) => {
    if (seen.has(alias)) return false;
    seen.add(alias);
    return true;
  });
}

function normalizedInteraction(initial: Interaction | undefined, sourceNodeId: string, command: string, fallback: boolean) {
  const value = structuredClone(initial ?? emptyInteraction(sourceNodeId, command, fallback));
  value.matchMode ??= fallback ? "fallback" : "command";
  value.choiceVisibility ??= "prompt";
  value.outcomes = value.outcomes.map((outcome) => ({
    ...outcome,
    authorStatus: outcome.authorStatus ?? "configured",
    responseCharactersPerSecond: outcome.responseCharactersPerSecond ?? 18,
  }));
  return value;
}

function ChoiceRevealSetting({ value, onChange }: {
  value: InteractionChoiceVisibility;
  onChange: (value: InteractionChoiceVisibility) => void;
}) {
  const selected = revealOptions.find((option) => option.value === value)?.label ?? "ON PROMPT";
  return <details className="choice-reveal-setting">
    <summary>CHOICE: {selected}</summary>
    <div className="choice-reveal-options">
      {revealOptions.map((option) => <button
        type="button"
        key={option.value}
        aria-pressed={value === option.value}
        title={option.help}
        onClick={() => onChange(option.value)}
      >[{option.label}]</button>)}
    </div>
  </details>;
}

export function InteractionEditor({
  snapshot,
  playState,
  initial,
  initialCommand = "",
  fallback = false,
  onSave,
  onCancel,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  initial?: Interaction;
  initialCommand?: string;
  fallback?: boolean;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const fallbackMode = fallback || initial?.matchMode === "fallback";
  const [draft, setDraft] = useState(() => normalizedInteraction(initial, playState.currentNodeId, initialCommand, fallbackMode));
  const [newNodeText, setNewNodeText] = useState<Record<string, string>>({});
  const [focusOutcomeId, setFocusOutcomeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const firstResponse = useRef<HTMLTextAreaElement>(null);

  const updateOutcome = (id: string, next: InteractionOutcome) =>
    setDraft((current) => ({ ...current, outcomes: current.outcomes.map((item) => item.id === id ? next : item) }));

  const addResponseDraft = () => {
    const outcome = emptyOutcome(draft.outcomes.length);
    setFocusOutcomeId(outcome.id);
    setDraft((current) => ({
      ...current,
      outcomes: [...current.outcomes, outcome],
    }));
  };

  const save = async () => {
    const userInputText = draft.wording.trim();
    if (!fallbackMode && !userInputText) {
      setError("Enter user-input-text. Its matching alias will be generated automatically.");
      return;
    }
    const incompleteTransition = draft.outcomes.find((outcome) =>
      outcome.disposition === "transition" && !outcome.destinationNodeId && !newNodeText[outcome.id]?.trim(),
    );
    if (incompleteTransition) {
      setError(`Choose an existing next node or enter its text for ${incompleteTransition.label || "the response"}.`);
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
      await onSave(
        [
          ...createdNodes.map((node): MutationOperation => ({ type: "node.upsert", node })),
          { type: "interaction.upsert", interaction },
        ],
        fallbackMode
          ? `${initial ? "Changed" : "Created"} invalid-input response for node ${snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}`
          : initial ? `Changed user input ${interaction.wording}` : `Created user input ${interaction.wording}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return <section className="author-panel author-panel-frame interaction-editor-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{fallbackMode ? "INVALID INPUT" : "USER INPUT"} FROM #{snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}</span></header>

    <div className="author-panel-body">
      <div className="causal-author-flow">
        {!fallbackMode ? <label className="user-input-field">USER-INPUT-TEXT
          <input value={draft.wording} onChange={(event) => setDraft({ ...draft, wording: event.target.value })}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              firstResponse.current?.focus();
            }} autoFocus enterKeyHint="next" />
        </label> : null}

        <div className="response-flow-heading"><strong>RESPONSE-TEXT</strong></div>
        {draft.outcomes.map((outcome, index) => <OutcomeEditor
          key={outcome.id}
          outcome={outcome}
          snapshot={snapshot}
          playState={playState}
          responseRef={index === 0 ? firstResponse : undefined}
          autoFocus={(fallbackMode && index === 0) || focusOutcomeId === outcome.id}
          newNodeText={newNodeText[outcome.id] ?? ""}
          onNewNodeText={(text) => setNewNodeText((current) => ({ ...current, [outcome.id]: text }))}
          onChange={(next) => updateOutcome(outcome.id, next)}
          onMove={(direction) => setDraft((current) => {
            const target = index + direction;
            if (target < 0 || target >= current.outcomes.length) return current;
            const outcomes = [...current.outcomes];
            [outcomes[index], outcomes[target]] = [outcomes[target], outcomes[index]];
            return { ...current, outcomes: outcomes.map((item, order) => ({ ...item, order })) };
          })}
          onRemove={draft.outcomes.length > 1 ? () => setDraft({ ...draft, outcomes: draft.outcomes.filter((item) => item.id !== outcome.id) }) : undefined}
          index={index}
        />)}

        <button className="add-response" type="button" aria-label="Add response" title="Add response" onClick={addResponseDraft}>+</button>

        {!fallbackMode ? <ChoiceRevealSetting value={draft.choiceVisibility} onChange={(choiceVisibility) => setDraft({ ...draft, choiceVisibility })} /> : null}
      </div>

      <details className="advanced-author-details">
        <summary>[{fallbackMode ? "AUTHOR DETAILS" : "ALIASES + AUTHOR DETAILS"}]</summary>
        {!fallbackMode ? <label>OTHER ALIASES <textarea rows={2} value={draft.aliases.join("\n")} placeholder="one alternate phrase per line"
          onChange={(event) => setDraft({ ...draft, aliases: event.target.value.split("\n") })} /></label>
        : null}
        <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        <label>AUTHOR NOTE <input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      </details>

      {error ? <div className="author-message" role="alert">{error}</div> : null}
    </div>
    <div className="author-actions author-panel-footer"><button type="button" onClick={() => void save()} disabled={saving}>[{saving ? "SAVING..." : "SAVE & PLAY"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button>{initial ? confirmDelete ? <><span>Delete this {fallbackMode ? "invalid-input response" : "user input"}?</span><button type="button" onClick={() => void onSave([{ type: "interaction.delete", id: initial.id }], fallbackMode ? "Deleted invalid-input response" : `Deleted user input ${initial.wording || initial.aliases[0]}`)}>[CONFIRM DELETE]</button><button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button></> : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE]</button> : null}</div>
  </section>;
}

function OutcomeEditor({ outcome, snapshot, playState, responseRef, autoFocus, newNodeText, onNewNodeText, onChange, onMove, onRemove, index }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  responseRef?: RefObject<HTMLTextAreaElement | null>;
  autoFocus?: boolean;
  newNodeText: string;
  onNewNodeText: (text: string) => void;
  onChange: (outcome: InteractionOutcome) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove?: () => void;
  index: number;
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
  const behaviorBadge = outcome.authorStatus === "draft" ? "[D]" : outcome.disposition === "stay" ? "[H]" : destinationNotation;
  const configure = (next: InteractionOutcome) => onChange({ ...next, authorStatus: "configured" });

  return <div className="outcome-editor">
    <ValueMentionField snapshot={snapshot} multiline rows={3} textareaRef={responseRef} autoFocus={autoFocus}
      ariaLabel={`Response text ${index + 1}`} value={outcome.responseText}
      onValueChange={(responseText) => onChange({ ...outcome, responseText })} />
    <details className="text-speed-setting response-speed-setting">
      <summary>[TEXT SPEED: {outcome.responseCharactersPerSecond ?? 18} CHARACTERS/SECOND]</summary>
      <label className="text-speed-input">CHARACTERS/SECOND <input type="number" min={1} max={120}
        value={outcome.responseCharactersPerSecond ?? 18}
        onChange={(event) => onChange({ ...outcome, responseCharactersPerSecond: Number(event.target.value) })} /></label>
    </details>

    <details className="behavior-details" onToggle={(event) => {
      if (event.currentTarget.open && outcome.authorStatus === "draft") configure(outcome);
    }}>
      <summary aria-label="Response settings"><span className={outcome.authorStatus === "draft" ? "notation-dead" : "notation-ready"}>{behaviorBadge}</span></summary>
      <div className="outcome-head"><label>RESPONSE LABEL <input aria-label="Response label" value={outcome.label} onChange={(event) => onChange({ ...outcome, label: event.target.value })} /></label><button type="button" onClick={() => onMove(-1)}>[↑]</button><button type="button" onClick={() => onMove(1)}>[↓]</button>{onRemove ? <button type="button" onClick={onRemove}>[REMOVE]</button> : null}</div>
      <div className="attempt-presets"><span>USE THIS RESPONSE:</span><button type="button" onClick={() => configure({ ...outcome, condition: { type: "attempt", operator: "eq", value: 1 } })}>[FIRST TIME]</button><button type="button" onClick={() => configure({ ...outcome, condition: { type: "attempt", operator: "eq", value: 2 } })}>[SECOND TIME]</button><button type="button" onClick={() => configure({ ...outcome, condition: { type: "attempt", operator: "gte", value: 2 } })}>[SECOND+]</button></div>
      <ConditionEditor condition={outcome.condition} onChange={(condition) => configure({ ...outcome, condition })} snapshot={snapshot} />
      <label>AFTER THE RESPONSE <select value={outcome.disposition} onChange={(event) => configure({ ...outcome, disposition: event.target.value as "stay" | "transition", destinationNodeId: event.target.value === "stay" ? null : outcome.destinationNodeId })}><option value="stay">keep the player at this node [H]</option><option value="transition">continue to another node</option></select></label>
      {outcome.disposition === "transition" ? <div className="destination-editor">
        {outcome.destinationNodeId ? <div className="selected-destination">LINKED {destinationNotation}: {snapshot.nodes.find((node) => node.id === outcome.destinationNodeId)?.text ?? outcome.destinationNodeId} <button type="button" onClick={() => configure({ ...outcome, destinationNodeId: null })}>[UNLINK]</button></div> : null}
        <label>NEXT NODE TEXT / FIND AN EXISTING NODE
          <textarea rows={2} value={newNodeText} onChange={(event) => onNewNodeText(event.target.value)} placeholder="Type what appears next; local matches appear below" />
        </label>
        {newNodeText.trim() && !outcome.destinationNodeId ? <div className="search-strip" role="listbox" aria-label="Existing destination matches">
          {matches.length ? matches.map((result) => <button type="button" role="option" key={result.id} onClick={() => configure({ ...outcome, destinationNodeId: result.id })}><span>{result.label}</span><span>{result.notation.join("")}</span></button>) : <span className="search-empty">No existing match — saving creates this as a new node.</span>}
        </div> : null}
      </div> : null}
      <label>EFFECTS — RUN TOP TO BOTTOM</label>
      <EffectsEditor effects={outcome.effects} onChange={(effects) => configure({ ...outcome, effects })} snapshot={snapshot} />
    </details>
  </div>;
}
