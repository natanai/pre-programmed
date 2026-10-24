import { useMemo, useState } from "react";
import { EffectsEditor } from "../../../author/EffectsEditor";
import {
  AuthorUiBlocks,
} from "../../../author/ui/AuthorWorkspaceRenderer";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { useAuthorResourceTools } from "../../../author/resources/context";
import { buildSearchIndex, searchProject } from "../../../author/search/projectSearch";
import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import {
  CAPTURE_EFFECT_AUTHORING_CONTEXT,
  captureFlowParts,
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
  const resources = useAuthorResourceTools();
  const parts = captureFlowParts(flow);
  const initialReply = parts?.presentStep;
  const [responseOpen, setResponseOpen] = useState(Boolean(initialReply?.responseText.trim()
    || initialReply?.dialogueText.trim() || initialReply?.speakerId));
  const [continuationOpen, setContinuationOpen] = useState(Boolean(flowDestination(flow) || flowReturnsPrevious(flow)));
  if (!parts) return null;
  const present = parts.presentStep;
  const savedKey = capturedInputVariableKey(flow);
  const savedVariable = snapshot.variables.find((variable) => variable.key === savedKey);
  const dialogueSpeakerId = conversationCharacterId ?? present.speakerId;
  const dialogueSpeakerName = dialogueSpeakerId
    ? snapshot.entities.find((entity) => entity.type === "character" && entity.id === dialogueSpeakerId)?.name ?? "Unknown character"
    : "";
  const showDialogue = Boolean(conversationCharacterId || present.speakerId || present.dialogueText.trim());
  const hasPostInputResponse = Boolean(present.responseText.trim() || present.dialogueText.trim() || present.speakerId);
  const hasContinuation = Boolean(flowDestination(flow) || flowReturnsPrevious(flow));
  const dialogueLabel = dialogueSpeakerName ? `${dialogueSpeakerName.toUpperCase()} SAYS` : "DIALOGUE — CHOOSE SPEAKER";
  const extraEffects = parts.effectsStep.effects.length - (savedKey ? 1 : 0);
  const destination = flowDestination(flow);
  const thenSummary = flowReturnsPrevious(flow) ? "return to previous Node"
    : destination ? `continue to Node #${snapshot.nodes.find((node) => node.id === destination.nodeId)?.nodeNumber ?? "?"}`
    : "stay at this Node";
  const updatePresent = (change: Partial<typeof present>) => {
    onChange(replaceCapturePresentation(flow, { ...present, ...change }));
  };

  return <div className="after-input-capture">
    <div className="capture-flow-intro">
      <strong>WAIT FOR THE PLAYER'S NEXT INPUT</strong>
      <p>The next terminal submission is captured once. It won't be treated as a command. Saving it is optional.</p>
    </div>

    <section className="capture-storage" aria-label="Save captured player text">
      <strong>SAVE SUBMITTED TEXT TO</strong>
      <ReferenceField
        kind="text-variable"
        value={savedKey}
        onChange={(key) => onChange(replaceCapturedInputVariable(flow, key))}
        placeholder="Don't save · use input only now"
      />
      <small>Choose an existing text variable, or create one here. A new variable starts as Text. The usual Set Variable effect stores exactly what the player typed.</small>
      {savedKey && !savedVariable ? <small role="status">This variable has not finished saving. Complete its Author task, then return here.</small> : null}
    </section>

    {savedVariable ? <div className="capture-character-link">
      <strong>USE AS A CHARACTER NAME <small>(optional)</small></strong>
      {conversationCharacterId && resources.canEdit("character", conversationCharacterId)
        ? <button type="button" onClick={() => resources.edit("character", conversationCharacterId, undefined, { proposedAliasVariableId: savedVariable.id })}>
          [+ ADD TO {snapshot.entities.find((entity) => entity.id === conversationCharacterId)?.name || "CHARACTER"}'S ALIASES]
        </button>
        : <ReferenceField
          kind="character"
          value=""
          placeholder="Choose Character to name"
          onChange={(characterId) => {
            if (characterId) resources.edit("character", characterId, undefined, { proposedAliasVariableId: savedVariable.id });
          }}
        />}
      <small>Opens that Character's real Author task with a suggested @ alias. Confirm there and save the Character.</small>
    </div> : null}

    <p className="capture-flow-summary" role="status">
      NEXT INPUT → {savedKey ? `save to ${savedVariable?.label || savedKey}` : "not stored"} → {hasPostInputResponse ? "respond" : "no response"} → {thenSummary}
    </p>

    <details className="capture-optional-section" open={responseOpen} onToggle={(event) => setResponseOpen(event.currentTarget.open)}>
      <summary>AFTER INPUT · NARRATION OR DIALOGUE <small>{hasPostInputResponse ? "Configured" : "Optional"}</small></summary>
      <div className="capture-optional-content">
        <p className="guided-context-copy">This happens after the player's submission, not before it. Leave empty to continue without speaking.</p>
        {!conversationCharacterId ? <label>SPEAKER
          <ReferenceField
            kind="character"
            value={present.speakerId ?? ""}
            onChange={(speakerId) => updatePresent({ speakerId: speakerId || null })}
            placeholder="none / narration"
          />
          <small>Choose a Character to speak after the input, if desired.</small>
        </label> : null}
        <div className={`narrative-prose-grid${showDialogue ? " has-dialogue" : ""}`}>
          <AuthoredTextEditor
            value={{ text: present.responseText, performance: present.responsePerformance }}
            snapshot={snapshot}
            playState={playState}
            label="NARRATION AFTER INPUT"
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
    </details>

    <details className="capture-optional-section">
      <summary>ON SUBMIT · ALL EFFECTS <small>{parts.effectsStep.effects.length} configured{extraEffects > 0 ? ` · ${extraEffects} additional` : ""}</small></summary>
      <div className="capture-optional-content">
        <p className="guided-context-copy">These run after the input, before any reply. The saved-text field above is a shortcut for a regular Set Variable effect. You can edit it here or add any other effect.</p>
        <EffectsEditor
          effects={parts.effectsStep.effects}
          snapshot={snapshot}
          authoringContext={CAPTURE_EFFECT_AUTHORING_CONTEXT}
          onChange={(effects) => onChange(replaceCaptureEffects(flow, effects))}
        />
      </div>
    </details>

    <details className="capture-optional-section" open={continuationOpen} onToggle={(event) => setContinuationOpen(event.currentTarget.open)}>
      <summary>THEN · WHERE TO GO <small>{thenSummary}</small></summary>
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
      if (!capture) onChange(createCaptureInputFlow());
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
