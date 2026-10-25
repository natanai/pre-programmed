import { AuthorHelp } from "../../../author/ui/AuthorHelp";
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
  captureFlowSegments,
  appendCaptureTurn,
  removeCaptureTurn,
  capturedInputVariableKey,
  createCaptureInputFlow,
  createReturnPreviousStep,
  createTransitionStep,
  flowDestination,
  flowReturnsPrevious,
  replaceCaptureEffects,
  replaceCapturePresentation,
  replaceCapturedInputVariable,
  replaceFlowReturnPrevious,
  replaceFlowTransition,
} from "../flow";
import { buildGraphIndex, notationForNode } from "../graph";
import type { NarrativeFlowStep } from "../model";
import { nodeAuthorLabel, nodeOpeningSnippet } from "../nodeOpenings";
import { AuthoredTextEditor, type AuthoredTextValue } from "./AuthoredTextEditor";
import "./interactionEditor.css";

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
        <div className="guided-option-with-help"><button
          type="button"
          className="guided-option-row"
          aria-pressed={!target.openingId}
          onClick={() => chooseTarget(destination.id, null)}
        >
          <span>{!target.openingId ? "[X]" : "[ ]"} AUTO</span>
        </button><AuthorHelp label="About automatic entry selection" text={`Node #${destination.nodeNumber} uses the first entry response with a matching WHEN condition.`} /></div>
        {[...destination.openings].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((opening, index) => <button
          type="button"
          className="guided-option-row"
          key={opening.id}
          aria-pressed={target.openingId === opening.id}
          onClick={() => chooseTarget(destination.id, opening.id)}
        >
          <span>{target.openingId === opening.id ? "[X]" : "[ ]"} {index + 1}. {nodeOpeningSnippet(opening, 64) || "No entry text"}</span>
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
  const turns = captureFlowSegments(flow);
  const [continuationOpen, setContinuationOpen] = useState(Boolean(flowDestination(flow) || flowReturnsPrevious(flow)));
  if (!turns.length) return null;

  const destination = flowDestination(flow);
  const thenSummary = flowReturnsPrevious(flow) ? "return previous"
    : destination ? `Node #${snapshot.nodes.find((node) => node.id === destination.nodeId)?.nodeNumber ?? "?"}`
    : "stay here";

  return <div className="after-input-capture">
    {turns.map((turn, index) => {
      const present = turn.presentStep;
      const awaitStepId = turn.awaitStep.id;
      const savedKey = capturedInputVariableKey(flow, awaitStepId);
      const savedVariable = snapshot.variables.find((variable) => variable.key === savedKey);
      const dialogueSpeakerId = conversationCharacterId ?? present.speakerId;
      const dialogueSpeakerName = dialogueSpeakerId
        ? snapshot.entities.find((entity) => entity.type === "character" && entity.id === dialogueSpeakerId)?.name ?? "Character"
        : "";
      const showDialogue = Boolean(conversationCharacterId || present.speakerId || present.dialogueText.trim());
      const additionalEffects = turn.effectsStep.effects.length - (savedKey ? 1 : 0);
      const changePresent = (change: Partial<typeof present>) =>
        onChange(replaceCapturePresentation(flow, { ...present, ...change }, awaitStepId));

      return <section className="capture-turn" key={awaitStepId} aria-label={`Captured input ${index + 1}`}>
        <div className="capture-turn-heading">
          <strong>INPUT {index + 1}</strong>
          {index > 0 ? <button type="button" onClick={() => onChange(removeCaptureTurn(flow, awaitStepId))}>[REMOVE]</button> : null}
        </div>
        <div className="capture-storage">
          <span>SAVE INPUT TO <small>(optional)</small></span>
          <ReferenceField
            kind="text-variable"
            value={savedKey}
            onChange={(key) => onChange(replaceCapturedInputVariable(flow, key, awaitStepId))}
            placeholder="Don't save"
          />
        </div>
        <div className="capture-reply">
          <strong>RESPOND AFTER INPUT {index + 1}</strong>
          {!conversationCharacterId ? <label>SPEAKER
            <ReferenceField
              kind="character"
              value={present.speakerId ?? ""}
              onChange={(speakerId) => changePresent({ speakerId: speakerId || null })}
              placeholder="none / narration"
            />
          </label> : null}
          <div className={`narrative-prose-grid${showDialogue ? " has-dialogue" : ""}`}>
            <AuthoredTextEditor
              value={{ text: present.responseText, performance: present.responsePerformance }}
              snapshot={snapshot}
              playState={playState}
              label="NARRATION"
              rows={3}
              onChange={(value) => changePresent({ responseText: value.text, responsePerformance: value.performance })}
              onPreview={onPreview ? (value) => onPreview(value, null) : undefined}
            />
            {showDialogue ? <AuthoredTextEditor
              value={{ text: present.dialogueText, performance: present.dialoguePerformance }}
              snapshot={snapshot}
              playState={playState}
              label={dialogueSpeakerName ? `${dialogueSpeakerName.toUpperCase()} SAYS` : "DIALOGUE"}
              rows={3}
              onChange={(value) => changePresent({ dialogueText: value.text, dialoguePerformance: value.performance })}
              onPreview={onPreview ? (value) => onPreview(value, dialogueSpeakerId) : undefined}
            /> : null}
          </div>
        </div>
        <details className="capture-optional-section">
          <summary>OTHER EFFECTS <small>{additionalEffects ? `${additionalEffects} additional` : "Optional"}</small></summary>
          <div className="capture-optional-content">
            <EffectsEditor
              effects={turn.effectsStep.effects}
              snapshot={snapshot}
              authoringContext={CAPTURE_EFFECT_AUTHORING_CONTEXT}
              onChange={(effects) => onChange(replaceCaptureEffects(flow, effects, awaitStepId))}
            />
          </div>
        </details>
      </section>;
    })}
    <button type="button" className="guided-add capture-add-turn" onClick={() => onChange(appendCaptureTurn(flow, snapshot.settings.defaults.textSpeed))}>
      [+ CAPTURE ANOTHER INPUT]
    </button>
    <details className="capture-optional-section" open={continuationOpen} onToggle={(event) => setContinuationOpen(event.currentTarget.open)}>
      <summary>THEN <small>{thenSummary}</small></summary>
      <div className="capture-optional-content">
        <DestinationPreset
          snapshot={snapshot}
          playState={playState}
          flow={flow}
          onChange={onChange}
          onCreateDestination={onCreateDestination}
          onEditDestination={onEditDestination}
        />
      </div>
    </details>
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
  const returnsPrevious = flowReturnsPrevious(flow);
  const selected = returnsPrevious ? "previous" : target || choosingExisting ? "existing" : "stay";

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
      if (value === "previous") {
        setChoosingExisting(false);
        onChange(replaceFlowReturnPrevious(flow, true));
        return;
      }
      if (value === "create") {
        setChoosingExisting(false);
        onCreateDestination?.((nodeId) => onChange(replaceFlowTransition(flow, { nodeId, openingId: null })));
        return;
      }
      setChoosingExisting(true);
      if (returnsPrevious) onChange(replaceFlowReturnPrevious(flow, false));
    },
    presentation: "segmented",
    options: [
      { value: "stay", label: "STAY HERE" },
      { value: "previous", label: "RETURN PREVIOUS" },
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
  const returnsPrevious = flowReturnsPrevious(flow);
  const selected = capture ? "capture" : returnsPrevious ? "previous" : target || choosingExisting ? "existing" : "stay";

  const choose = (value: string) => {
    if (value === "stay") {
      setChoosingExisting(false);
      onChange([]);
      return;
    }
    if (value === "capture") {
      setChoosingExisting(false);
      if (!capture) onChange(createCaptureInputFlow(snapshot.settings.defaults.textSpeed));
      return;
    }
    if (value === "previous") {
      setChoosingExisting(false);
      onChange([createReturnPreviousStep()]);
      return;
    }
    if (value === "create") {
      setChoosingExisting(false);
      onCreateDestination?.((nodeId) => onChange([createTransitionStep({ nodeId, openingId: null })]));
      return;
    }
    setChoosingExisting(true);
    if (capture || returnsPrevious) onChange([]);
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
        value: "previous",
        label: "RETURN PREVIOUS",
        help: "Re-enter the Node that immediately led here, using real traversal history.",
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
