import { useMemo, useState } from "react";
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
import { ConditionEditor, EffectsEditor, ValueTokenBar } from "./AuthorFields";

const revealOptions: Array<{ value: InteractionChoiceVisibility; label: string; help: string }> = [
  { value: "immediate", label: "SHOW NOW", help: "Visible beside the prompt immediately." },
  { value: "prompt", label: "SHOW ON TAP", help: "Revealed when the player taps or clicks the prompt." },
  { value: "typed", label: "TYPING ONLY", help: "Never shown as a choice; the player must type it." },
];

function emptyOutcome(order = 0, responseText = ""): InteractionOutcome {
  return {
    id: makeId(),
    order,
    label: order === 0 ? "default" : `response ${order + 1}`,
    authorStatus: "draft",
    condition: ALWAYS,
    responseText,
    effects: [],
    disposition: "stay",
    destinationNodeId: null,
  };
}

function emptyInteraction(sourceNodeId: string, command = ""): Interaction {
  return {
    id: makeId(),
    sourceNodeId,
    wording: command,
    choiceVisibility: "prompt",
    aliases: command ? [command] : [],
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

function normalizedInteraction(initial: Interaction | undefined, sourceNodeId: string, command: string) {
  const value = structuredClone(initial ?? emptyInteraction(sourceNodeId, command));
  value.choiceVisibility ??= "prompt";
  value.outcomes = value.outcomes.map((outcome) => ({ ...outcome, authorStatus: outcome.authorStatus ?? "configured" }));
  return value;
}

function ChoiceRevealSetting({ value, onChange }: {
  value: InteractionChoiceVisibility;
  onChange: (value: InteractionChoiceVisibility) => void;
}) {
  return <fieldset className="choice-reveal-setting">
    <legend>PLAYER DISCOVERY</legend>
    <div className="choice-reveal-options">
      {revealOptions.map((option) => <button
        type="button"
        key={option.value}
        aria-pressed={value === option.value}
        title={option.help}
        onClick={() => onChange(option.value)}
      >[{option.label}]</button>)}
    </div>
    <small>{revealOptions.find((option) => option.value === value)?.help}</small>
  </fieldset>;
}

export function InteractionEditor({
  snapshot,
  playState,
  initial,
  initialCommand = "",
  onSave,
  onCancel,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  initial?: Interaction;
  initialCommand?: string;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => normalizedInteraction(initial, playState.currentNodeId, initialCommand));
  const [newNodeText, setNewNodeText] = useState<Record<string, string>>({});
  const [quickResponse, setQuickResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const updateOutcome = (id: string, next: InteractionOutcome) =>
    setDraft((current) => ({ ...current, outcomes: current.outcomes.map((item) => item.id === id ? next : item) }));

  const addResponseDraft = () => {
    setDraft((current) => ({
      ...current,
      outcomes: [...current.outcomes, emptyOutcome(current.outcomes.length, quickResponse.trim())],
    }));
    setQuickResponse("");
  };

  const save = async () => {
    const userInputText = draft.wording.trim();
    if (!userInputText) {
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
        wording: userInputText,
        aliases: aliasesForUserInput(userInputText, draft.aliases),
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
        initial ? `Changed user input ${interaction.wording}` : `Created user input ${interaction.wording}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return <section className="author-panel interaction-editor-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>USER INPUT FROM #{snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}</span><button type="button" onClick={onCancel}>[X]</button></header>

    <div className="causal-author-flow">
      <label className="user-input-field">USER-INPUT-TEXT
        <input value={draft.wording} onChange={(event) => setDraft({ ...draft, wording: event.target.value })} autoFocus />
        <small>This is what the player types or selects.</small>
      </label>
      <ChoiceRevealSetting value={draft.choiceVisibility} onChange={(choiceVisibility) => setDraft({ ...draft, choiceVisibility })} />

      <div className="response-flow-heading"><span aria-hidden="true">↓</span><strong>WHAT THEY SEE IN RESPONSE</strong></div>
      {draft.outcomes.map((outcome, index) => <OutcomeEditor
        key={outcome.id}
        outcome={outcome}
        snapshot={snapshot}
        playState={playState}
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

      <div className="quick-response-add">
        <input
          aria-label="New response-text draft"
          value={quickResponse}
          placeholder="another possible response-text"
          onChange={(event) => setQuickResponse(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addResponseDraft();
          }}
        />
        <button type="button" onClick={addResponseDraft}>[+ DRAFT RESPONSE [D]]</button>
      </div>
      <small className="muted">New response drafts stay marked [D] until you open their behavior.</small>
    </div>

    <details className="advanced-author-details">
      <summary>[ALIASES + AUTHOR DETAILS]</summary>
      <p className="muted">The user-input-text is already a generated parser alias. Add only alternate ways a player may type it.</p>
      <label>OTHER ALIASES <textarea rows={2} value={draft.aliases.join("\n")} placeholder="one alternate phrase per line"
        onChange={(event) => setDraft({ ...draft, aliases: event.target.value.split("\n") })} /></label>
      <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
      <label>AUTHOR NOTE <input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
    </details>

    {error ? <div className="author-message" role="alert">{error}</div> : null}
    <div className="author-actions"><button type="button" onClick={() => void save()} disabled={saving}>[{saving ? "SAVING..." : "SAVE & PLAY"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button>{initial ? confirmDelete ? <><span>Delete this user input?</span><button type="button" onClick={() => void onSave([{ type: "interaction.delete", id: initial.id }], `Deleted user input ${initial.wording || initial.aliases[0]}`)}>[CONFIRM DELETE]</button><button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button></> : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE]</button> : null}</div>
  </section>;
}

export function QuickInputsEditor({ snapshot, playState, onSave, onCancel }: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [choiceVisibility, setChoiceVisibility] = useState<InteractionChoiceVisibility>("prompt");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const values = [...new Set(text.split("\n").map((value) => value.trim()).filter(Boolean))];

  const save = async () => {
    if (!values.length) { setError("Enter at least one user-input-text, one per line."); return; }
    if (values.length > 40) { setError("Add no more than forty at once."); return; }
    setSaving(true);
    try {
      const operations: MutationOperation[] = values.map((wording) => ({
        type: "interaction.upsert",
        interaction: {
          ...emptyInteraction(playState.currentNodeId, wording),
          choiceVisibility,
        },
      }));
      await onSave(operations, `Created ${values.length} draft user inputs from node #${snapshot.nodes.find((node) => node.id === playState.currentNodeId)?.nodeNumber}`);
    } finally { setSaving(false); }
  };

  return <section className="author-panel quick-inputs-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>QUICK USER INPUTS FROM #{snapshot.nodes.find((node) => node.id === playState.currentNodeId)?.nodeNumber}</span><button type="button" onClick={onCancel}>[X]</button></header>
    <label>USER-INPUT-TEXTS
      <textarea rows={7} value={text} onChange={(event) => setText(event.target.value)} placeholder="one possible player input per line" autoFocus />
    </label>
    <ChoiceRevealSetting value={choiceVisibility} onChange={setChoiceVisibility} />
    <p className="muted">Each line becomes a clickable [D] draft. Open a draft afterward to write its response and assign behavior.</p>
    {error ? <div className="author-message" role="alert">{error}</div> : null}
    <div className="author-actions"><button type="button" disabled={saving} onClick={() => void save()}>[{saving ? "SAVING..." : `CREATE ${values.length || ""} DRAFT${values.length === 1 ? "" : "S"}`}]</button><button type="button" onClick={onCancel}>[CANCEL]</button></div>
  </section>;
}

function OutcomeEditor({ outcome, snapshot, playState, newNodeText, onNewNodeText, onChange, onMove, onRemove, index }: {
  outcome: InteractionOutcome;
  snapshot: ProjectSnapshot;
  playState: PlayState;
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
  const insertResponse = (token: string) => onChange({ ...outcome, responseText: `${outcome.responseText}${token}` });
  const configure = (next: InteractionOutcome) => onChange({ ...next, authorStatus: "configured" });

  return <fieldset className={`outcome-editor${outcome.authorStatus === "draft" ? " draft-outcome" : ""}`}>
    <legend><span className={outcome.authorStatus === "draft" ? "notation-dead" : "notation-ready"}>{behaviorBadge}</span> RESPONSE {index + 1}</legend>
    <label className="response-text-field">RESPONSE-TEXT
      <textarea rows={3} value={outcome.responseText} onChange={(event) => onChange({ ...outcome, responseText: event.target.value })} />
      <small>This appears directly after the user-input-text.</small>
    </label>
    <ValueTokenBar snapshot={snapshot} onInsert={insertResponse} />

    <details className="behavior-details" onToggle={(event) => {
      if (event.currentTarget.open && outcome.authorStatus === "draft") configure(outcome);
    }}>
      <summary>{behaviorBadge} {outcome.authorStatus === "draft" ? "ASSIGN BEHAVIOR" : "BEHAVIOR"}</summary>
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
  </fieldset>;
}
