import { useMemo, useState } from "react";
import { EffectsEditor } from "../../../author/EffectsEditor";
import {
  AuthorUiBlocks,
} from "../../../author/ui/AuthorWorkspaceRenderer";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { buildSearchIndex, searchProject } from "../../../author/search/projectSearch";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import {
  CAPTURE_EFFECT_AUTHORING_CONTEXT,
  captureFlowParts,
  createCaptureInputFlow,
  createTransitionStep,
  flowDestination,
  replaceCaptureEffects,
  replaceCapturePresentation,
  replaceFlowTransition,
} from "../flow";
import { buildGraphIndex, notationForNode } from "../graph";
import type { NarrativeFlowStep } from "../model";
import { nodeAuthorLabel, nodeOpeningSnippet } from "../nodeOpenings";
import { AuthoredTextEditor, type AuthoredTextValue } from "./AuthoredTextEditor";

function conditionlessOpeningLabel(snapshot: ProjectSnapshot, nodeId: string, openingId: string | null) {
  const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return "Missing Node";
  if (!openingId) return `${nodeAuthorLabel(node)} · AUTO`;
  const opening = node.openings.find((candidate) => candidate.id === openingId);
  return `${nodeAuthorLabel(node)} · ${opening ? nodeOpeningSnippet(opening, 54) || "specific opening" : "missing opening"}`;
}

function DestinationEditor({
  snapshot,
  playState,
  flow,
  onChange,
  onCreateDestination,
  onEditDestination,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  flow: NarrativeFlowStep[];
  onChange: (flow: NarrativeFlowStep[]) => void;
  onCreateDestination?: (onCreated: (nodeId: string) => void) => void;
  onEditDestination?: (nodeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const documents = useMemo(() => buildSearchIndex(snapshot), [snapshot]);
  const graph = useMemo(() => buildGraphIndex(snapshot), [snapshot]);
  const matches = useMemo(
    () => searchProject(snapshot, documents, playState, query, ["node"], 12),
    [snapshot, documents, playState, query],
  );
  const target = flowDestination(flow);
  const destination = target ? snapshot.nodes.find((node) => node.id === target.nodeId) : null;
  const destinationNotation = target
    ? notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, target.nodeId).join("") || "[A1]"
    : "[D]";

  const chooseTarget = (nodeId: string, openingId: string | null) => {
    setQuery("");
    onChange(replaceFlowTransition(flow, { nodeId, openingId }));
  };

  return <div className="narrative-destination-editor">
    {target ? <div className="selected-destination">
      <span>LINKED {destinationNotation}: {conditionlessOpeningLabel(snapshot, target.nodeId, target.openingId)}</span>
      <span className="selected-destination-actions">
        {onEditDestination ? <button type="button" onClick={() => onEditDestination(target.nodeId)}>[EDIT NODE]</button> : null}
        <button type="button" onClick={() => onChange(replaceFlowTransition(flow, null))}>[UNLINK]</button>
      </span>
      {destination ? <div className="guided-option-list" aria-label="Destination Node entry response">
        <button
          type="button"
          className="guided-option-row"
          aria-pressed={!target.openingId}
          onClick={() => chooseTarget(destination.id, null)}
        >
          <span>{!target.openingId ? "[X]" : "[ ]"} AUTO</span>
          <small>Let Node #{destination.nodeNumber} choose its entry response from current conditions.</small>
        </button>
        {[...destination.openings].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((opening, index) => <button
          type="button"
          className="guided-option-row"
          key={opening.id}
          aria-pressed={target.openingId === opening.id}
          onClick={() => chooseTarget(destination.id, opening.id)}
        >
          <span>{target.openingId === opening.id ? "[X]" : "[ ]"} {index + 1}. {nodeOpeningSnippet(opening, 64) || "No entry text"}</span>
          <small>Explicit entry selection</small>
        </button>)}
      </div> : null}
    </div> : null}

    <AuthorUiBlocks blocks={[{
      type: "field",
      id: "narrative-flow-existing-destination",
      label: "Find existing node",
      labelMode: "sr-only",
      control: "search",
      value: query,
      onChange: setQuery,
      placeholder: "Find by node number, label, entry text, tags, or conditions…",
      inputMode: "search",
    }]} />

    {query.trim() ? <div className="search-strip guided-destination-results" role="listbox" aria-label="Existing destination matches">
      {matches.length ? matches.map((result) => {
        const node = snapshot.nodes.find((candidate) => candidate.id === result.id);
        if (!node) return null;
        return <div className="guided-destination-result" key={result.id}>
          <button type="button" role="option" className="guided-destination-select" onClick={() => chooseTarget(node.id, null)}>
            <span>{result.label}</span><span>{result.notation.join("")} · AUTO</span>
          </button>
          {[...node.openings].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((opening, index) => <button
            type="button"
            className="guided-destination-select"
            key={opening.id}
            onClick={() => chooseTarget(node.id, opening.id)}
          >
            <span>↳ {index + 1}. {nodeOpeningSnippet(opening, 72) || "No entry text"}</span>
            <span>specific entry</span>
          </button>)}
          {onEditDestination ? <button type="button" className="guided-destination-edit" onClick={() => onEditDestination(result.id)}>[EDIT]</button> : null}
        </div>;
      }) : <span className="search-empty">No existing node matches this search.</span>}
    </div> : null}

    {onCreateDestination ? <button
      type="button"
      className="guided-add"
      onClick={() => onCreateDestination((nodeId) => onChange(replaceFlowTransition(flow, { nodeId, openingId: null })))}
    >[+ CREATE NEW NODE]</button> : null}
  </div>;
}

function CaptureFlowEditor({
  snapshot,
  playState,
  flow,
  conversationCharacterId,
  onChange,
  onCreateDestination,
  onEditDestination,
  onPreview,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  flow: NarrativeFlowStep[];
  conversationCharacterId: string | null;
  onChange: (flow: NarrativeFlowStep[]) => void;
  onCreateDestination?: (onCreated: (nodeId: string) => void) => void;
  onEditDestination?: (nodeId: string) => void;
  onPreview?: (value: AuthoredTextValue, speakerId: string | null) => void;
}) {
  const parts = captureFlowParts(flow);
  if (!parts) return null;
  const present = parts.presentStep;
  const dialogueSpeakerId = conversationCharacterId ?? present.speakerId;
  const dialogueSpeakerName = dialogueSpeakerId
    ? snapshot.entities.find((entity) => entity.type === "character" && entity.id === dialogueSpeakerId)?.name ?? "Unknown character"
    : "";
  const showDialogue = Boolean(conversationCharacterId || present.speakerId || present.dialogueText.trim());
  const dialogueLabel = dialogueSpeakerName ? `${dialogueSpeakerName.toUpperCase()} SAYS` : "DIALOGUE — CHOOSE SPEAKER";

  const updatePresent = (change: Partial<typeof present>) => {
    onChange(replaceCapturePresentation(flow, { ...present, ...change }));
  };

  return <div className="after-input-capture">
    <p className="guided-context-copy">The next player submission is consumed once. Everything below continues inside this same response flow.</p>

    <div className="after-input-capture-section">
      <strong>ON SUBMIT</strong>
      <EffectsEditor
        effects={parts.effectsStep.effects}
        snapshot={snapshot}
        authoringContext={CAPTURE_EFFECT_AUTHORING_CONTEXT}
        onChange={(effects) => onChange(replaceCaptureEffects(flow, effects))}
      />
    </div>

    <div className="after-input-capture-section">
      <strong>RESPONSE</strong>
      {!conversationCharacterId ? <label>SPEAKER
        <ReferenceField
          kind="character"
          value={present.speakerId ?? ""}
          onChange={(speakerId) => updatePresent({ speakerId: speakerId || null })}
          placeholder="none / narration"
        />
        <small>Optional. Choose a Character to make the post-input response spoken dialogue.</small>
      </label> : null}
      <div className={`narrative-prose-grid${showDialogue ? " has-dialogue" : ""}`}>
        <AuthoredTextEditor
          value={{ text: present.responseText, performance: present.responsePerformance }}
          snapshot={snapshot}
          playState={playState}
          label="NARRATION"
          rows={3}
          onChange={(value) => updatePresent({ responseText: value.text, responsePerformance: value.performance })}
          onPreview={onPreview ? (value) => onPreview(value, null) : undefined}
        />
        {showDialogue ? <AuthoredTextEditor
          value={{ text: present.dialogueText, performance: present.dialoguePerformance }}
          snapshot={snapshot}
          playState={playState}
          label={dialogueLabel}
          rows={3}
          onChange={(value) => updatePresent({ dialogueText: value.text, dialoguePerformance: value.performance })}
          onPreview={onPreview ? (value) => onPreview(value, dialogueSpeakerId) : undefined}
        /> : null}
      </div>
    </div>

    <div className="after-input-capture-section">
      <strong>THEN</strong>
      <DestinationPreset
        snapshot={snapshot}
        playState={playState}
        flow={flow}
        onChange={onChange}
        onCreateDestination={onCreateDestination}
        onEditDestination={onEditDestination}
      />
    </div>
  </div>;
}

function DestinationPreset({
  snapshot,
  playState,
  flow,
  onChange,
  onCreateDestination,
  onEditDestination,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  flow: NarrativeFlowStep[];
  onChange: (flow: NarrativeFlowStep[]) => void;
  onCreateDestination?: (onCreated: (nodeId: string) => void) => void;
  onEditDestination?: (nodeId: string) => void;
}) {
  const [choosingExisting, setChoosingExisting] = useState(false);
  const target = flowDestination(flow);
  const selected = target || choosingExisting ? "existing" : "stay";

  return <AuthorUiBlocks blocks={[{
    type: "choice",
    id: "narrative-flow-then",
    label: "What happens after this?",
    labelMode: "sr-only",
    value: selected,
    onChange: (value) => {
      if (value === "stay") {
        setChoosingExisting(false);
        onChange(replaceFlowTransition(flow, null));
        return;
      }
      if (value === "create") {
        setChoosingExisting(false);
        onCreateDestination?.((nodeId) => onChange(replaceFlowTransition(flow, { nodeId, openingId: null })));
        return;
      }
      setChoosingExisting(true);
    },
    presentation: "segmented",
    options: [
      { value: "stay", label: "STAY HERE" },
      { value: "create", label: "CREATE NEW" },
      {
        value: "existing",
        label: "LINK EXISTING",
        content: selected === "existing" ? [{
          type: "custom",
          id: "narrative-flow-then-destination",
          role: "specialized-control",
          content: <DestinationEditor
            snapshot={snapshot}
            playState={playState}
            flow={flow}
            onChange={(next) => {
              setChoosingExisting(Boolean(flowDestination(next)));
              onChange(next);
            }}
            onCreateDestination={onCreateDestination}
            onEditDestination={onEditDestination}
          />,
        }] : [],
      },
    ],
  }]} />;
}

export function NarrativeAfterEditor({
  snapshot,
  playState,
  flow,
  conversationCharacterId = null,
  onChange,
  onCreateDestination,
  onEditDestination,
  onPreview,
}: {
  snapshot: ProjectSnapshot;
  playState: PlayState;
  flow: NarrativeFlowStep[];
  conversationCharacterId?: string | null;
  onChange: (flow: NarrativeFlowStep[]) => void;
  onCreateDestination?: (onCreated: (nodeId: string) => void) => void;
  onEditDestination?: (nodeId: string) => void;
  onPreview?: (value: AuthoredTextValue, speakerId: string | null) => void;
}) {
  const [choosingExisting, setChoosingExisting] = useState(false);
  const capture = captureFlowParts(flow);
  const target = flowDestination(flow);
  const selected = capture ? "capture" : target || choosingExisting ? "existing" : "stay";

  const choose = (value: string) => {
    if (value === "stay") {
      setChoosingExisting(false);
      onChange([]);
      return;
    }
    if (value === "capture") {
      setChoosingExisting(false);
      if (!capture) onChange(createCaptureInputFlow());
      return;
    }
    if (value === "create") {
      setChoosingExisting(false);
      onCreateDestination?.((nodeId) => onChange([createTransitionStep({ nodeId, openingId: null })]));
      return;
    }
    setChoosingExisting(true);
    if (capture) onChange([]);
  };

  const captureEditor = capture ? <CaptureFlowEditor
    snapshot={snapshot}
    playState={playState}
    flow={flow}
    conversationCharacterId={conversationCharacterId}
    onChange={onChange}
    onCreateDestination={onCreateDestination}
    onEditDestination={onEditDestination}
    onPreview={onPreview}
  /> : null;

  return <AuthorUiBlocks blocks={[{
    type: "choice",
    id: "narrative-after-flow",
    label: "What happens after this response?",
    labelMode: "sr-only",
    value: selected,
    onChange: choose,
    presentation: "segmented",
    options: [
      {
        value: "stay",
        label: "STAY HERE",
        help: "End this flow at the current Node.",
      },
      {
        value: "create",
        label: "CREATE NEW",
        help: "Create a Node through the real Node author task, then continue there.",
      },
      {
        value: "existing",
        label: "LINK EXISTING",
        help: "Continue to a Node that already exists.",
        content: selected === "existing" ? [{
          type: "custom",
          id: "narrative-after-existing-destination",
          role: "specialized-control",
          content: <DestinationEditor
            snapshot={snapshot}
            playState={playState}
            flow={flow}
            onChange={(next) => {
              setChoosingExisting(Boolean(flowDestination(next)));
              onChange(next);
            }}
            onCreateDestination={onCreateDestination}
            onEditDestination={onEditDestination}
          />,
        }] : [],
      },
      {
        value: "capture",
        label: "CAPTURE INPUT",
        help: "Wait for one player submission, then keep running this same flow.",
        content: captureEditor ? [{
          type: "custom",
          id: "narrative-after-capture",
          role: "specialized-control",
          content: captureEditor,
        }] : [],
      },
    ],
  }]} />;
}
