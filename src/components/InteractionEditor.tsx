import { useMemo, useState } from "react";
import { buildSearchIndex, searchProject } from "../game/search";
import {
  ALWAYS,
  makeId,
  nextNodeNumber,
  type GameNode,
  type Interaction,
  type InteractionOutcome,
  type MutationOperation,
  type PlayState,
  type ProjectSnapshot,
} from "../game/model";
import { ConditionEditor, EffectsEditor, ValueTokenBar } from "./AuthorFields";

function emptyOutcome(order = 0): InteractionOutcome {
  return {
    id: makeId(),
    order,
    label: order === 0 ? "default" : `outcome ${order + 1}`,
    condition: ALWAYS,
    responseText: "",
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
    aliases: command ? [command] : [],
    tags: [],
    notes: "",
    outcomes: [emptyOutcome()],
  };
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
  const [draft, setDraft] = useState(() => structuredClone(initial ?? emptyInteraction(playState.currentNodeId, initialCommand)));
  const [newNodeText, setNewNodeText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const updateOutcome = (id: string, next: InteractionOutcome) =>
    setDraft((current) => ({ ...current, outcomes: current.outcomes.map((item) => item.id === id ? next : item) }));

  const save = async () => {
    if (!draft.aliases.some((alias) => alias.trim())) {
      setError("Add at least one parser alias.");
      return;
    }
    const incompleteTransition = draft.outcomes.find((outcome) =>
      outcome.disposition === "transition" && !outcome.destinationNodeId && !newNodeText[outcome.id]?.trim(),
    );
    if (incompleteTransition) {
      setError(`Choose an existing destination or enter new node text for ${incompleteTransition.label || "the transition"}.`);
      return;
    }
    setError("");
    setSaving(true);
    try {
      let nodeNumber = nextNodeNumber(snapshot);
      const createdNodes: GameNode[] = [];
      const interaction: Interaction = {
        ...draft,
        aliases: draft.aliases.map((alias) => alias.trim()).filter(Boolean),
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
        initial ? `Changed interaction ${interaction.wording || interaction.aliases[0]}` : `Created interaction ${interaction.wording || interaction.aliases[0]}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return <section className="author-panel interaction-editor-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>INTERACTION FROM #{snapshot.nodes.find((node) => node.id === draft.sourceNodeId)?.nodeNumber}</span><button type="button" onClick={onCancel}>[X]</button></header>
    <label>PLAYER-FACING WORDING <input value={draft.wording} onChange={(event) => setDraft({ ...draft, wording: event.target.value })} /></label>
    <label>ALIASES <textarea rows={2} value={draft.aliases.join("\n")} placeholder="one free-text command per line"
      onChange={(event) => setDraft({ ...draft, aliases: event.target.value.split("\n") })} /></label>
    <label>TAGS <input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
    <label>AUTHOR NOTE <input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>

    <div className="outcomes"><p className="muted">Outcomes are checked top to bottom; the first matching condition runs.</p>
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
      <button type="button" onClick={() => setDraft({ ...draft, outcomes: [...draft.outcomes, emptyOutcome(draft.outcomes.length)] })}>[+ CONDITIONAL OUTCOME]</button>
    </div>
    {error ? <div className="author-message" role="alert">{error}</div> : null}
    <div className="author-actions"><button type="button" onClick={() => void save()} disabled={saving}>[{saving ? "SAVING..." : "SAVE & PLAY"}]</button><button type="button" onClick={onCancel}>[CANCEL]</button>{initial ? confirmDelete ? <><span>Delete this interaction?</span><button type="button" onClick={() => void onSave([{ type: "interaction.delete", id: initial.id }], `Deleted interaction ${initial.wording || initial.aliases[0]}`)}>[CONFIRM DELETE]</button><button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button></> : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE]</button> : null}</div>
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
  const matches = useMemo(
    () => searchProject(snapshot, documents, playState, newNodeText, ["node"], 12),
    [snapshot, documents, playState, newNodeText],
  );
  const insertResponse = (token: string) => onChange({ ...outcome, responseText: `${outcome.responseText}${token}` });
  return <fieldset className="outcome-editor">
    <legend>OUTCOME {index + 1}</legend>
    <div className="outcome-head"><input aria-label="Outcome label" value={outcome.label} onChange={(event) => onChange({ ...outcome, label: event.target.value })} /><button type="button" onClick={() => onMove(-1)}>[↑]</button><button type="button" onClick={() => onMove(1)}>[↓]</button>{onRemove ? <button type="button" onClick={onRemove}>[REMOVE]</button> : null}</div>
    <div className="attempt-presets"><span>WHEN:</span><button type="button" onClick={() => onChange({ ...outcome, condition: { type: "attempt", operator: "eq", value: 1 } })}>[FIRST]</button><button type="button" onClick={() => onChange({ ...outcome, condition: { type: "attempt", operator: "eq", value: 2 } })}>[SECOND]</button><button type="button" onClick={() => onChange({ ...outcome, condition: { type: "attempt", operator: "gte", value: 2 } })}>[2+]</button></div>
    <ConditionEditor condition={outcome.condition} onChange={(condition) => onChange({ ...outcome, condition })} snapshot={snapshot} />
    <label>OUTPUT <textarea rows={3} value={outcome.responseText} onChange={(event) => onChange({ ...outcome, responseText: event.target.value })} /></label>
    <ValueTokenBar snapshot={snapshot} onInsert={insertResponse} />
    <label>RESULT <select value={outcome.disposition} onChange={(event) => onChange({ ...outcome, disposition: event.target.value as "stay" | "transition", destinationNodeId: event.target.value === "stay" ? null : outcome.destinationNodeId })}><option value="stay">stay here</option><option value="transition">transition</option></select></label>
    {outcome.disposition === "transition" ? <div className="destination-editor">
      {outcome.destinationNodeId ? <div className="selected-destination">LINKED: {snapshot.nodes.find((node) => node.id === outcome.destinationNodeId)?.text ?? outcome.destinationNodeId} <button type="button" onClick={() => onChange({ ...outcome, destinationNodeId: null })}>[UNLINK]</button></div> : null}
      <label>NEW NODE TEXT / FIND EXISTING
        <textarea rows={2} value={newNodeText} onChange={(event) => onNewNodeText(event.target.value)} placeholder="Type what happens next; matches stay local" />
      </label>
      {newNodeText.trim() && !outcome.destinationNodeId ? <div className="search-strip" role="listbox" aria-label="Existing destination matches">
        {matches.length ? matches.map((result) => <button type="button" role="option" key={result.id} onClick={() => onChange({ ...outcome, destinationNodeId: result.id })}><span>{result.label}</span><span>{result.notation.join("")}</span></button>) : <span className="search-empty">No existing match — saving will create a new node.</span>}
      </div> : null}
    </div> : null}
    <label>EFFECTS (RUN TOP TO BOTTOM)</label>
    <EffectsEditor effects={outcome.effects} onChange={(effects) => onChange({ ...outcome, effects })} snapshot={snapshot} />
  </fieldset>;
}
