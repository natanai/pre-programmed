import { EffectsEditor } from "../../../author/EffectsEditor";
import { OutcomeConditionEditor } from "../../../author/outcomes/OutcomeComposer";
import type { AuthorWorkspaceContext } from "../../../author/features/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { ValueMentionField } from "../../../author/ValueMentionField";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { makeId } from "../../../engine/project/id";
import { resolveActiveNodeAnchor } from "../anchor";
import type { GameNode, NodeAnchor, NodeContextMode, NodeOpening } from "../model";
import { createNodeOpening, nodeAuthorTitle, nodeOpeningSnippet } from "../nodeOpenings";
import { nextNodeNumber } from "../nodeNumber";
import {
  nodeConversationCharacterId,
  nodeConversationMode,
  nodeLocationMode,
  normalizeNodeContext,
  resolveActiveNodeContext,
} from "../sceneContext";
import { AuthoredTextEditor } from "./AuthoredTextEditor";
import { NodeInputList } from "./NodeInputList";
import { notationForNodeOpeningCondition } from "./notation";
import "./nodeWorkspace.css";

type NodeWorkspaceDraft = {
  node: GameNode;
};

const CONTINUE_ANCHOR: NodeAnchor = { mode: "continue", text: "" };

function nodeAnchor(node: GameNode): NodeAnchor {
  return node.anchor ?? CONTINUE_ANCHOR;
}

function nodeForRoute(route: AuthorTaskRoute, context: AuthorWorkspaceContext) {
  if (route.type !== "feature" || route.feature !== "narrative" || route.workspace !== "node") return undefined;
  const requestedNodeId = route.data?.nodeId;
  const existing = requestedNodeId
    ? context.snapshot.nodes.find((candidate) => candidate.id === requestedNodeId)
    : undefined;
  if (existing) return structuredClone(existing);
  if (route.data?.resourceTask !== "node") return undefined;
  return {
    id: makeId(),
    nodeNumber: nextNodeNumber(context.snapshot),
    authorLabel: "",
    openings: [createNodeOpening(0)],
    ending: false,
    tags: [],
    locationId: null,
    locationMode: "continue",
    conversationCharacterId: null,
    conversationMode: "continue",
    anchor: { ...CONTINUE_ANCHOR },
    entryEffects: [],
  } satisfies GameNode;
}

function routeData(route: AuthorTaskRoute) {
  return route.type === "feature" ? route.data : undefined;
}

function inputRoute(nodeId: string, interactionId?: string, fallback = false): AuthorTaskRoute {
  return {
    type: "feature",
    feature: "narrative",
    workspace: "interaction",
    data: {
      sourceNodeId: nodeId,
      ...(interactionId ? { interactionId } : {}),
      ...(fallback ? { fallback: "true" } : {}),
    },
  };
}

function clip(value: string, length = 42) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function entityName(context: AuthorWorkspaceContext, id: string | null | undefined, type: "character" | "location") {
  if (!id) return "";
  const entity = context.snapshot.entities.find((candidate) => candidate.id === id && candidate.type === type);
  return entity?.name || entity?.key || "missing resource";
}

function OpeningEditor({
  opening,
  index,
  total,
  snapshot,
  playState,
  conversationName,
  conversationCharacterId,
  references,
  autoFocus,
  focusSection,
  onChange,
  onMove,
  onRemove,
  onPreview,
}: {
  opening: NodeOpening;
  index: number;
  total: number;
  snapshot: AuthorWorkspaceContext["snapshot"];
  playState: AuthorWorkspaceContext["playState"];
  conversationName: string;
  conversationCharacterId: string | null;
  references: number;
  autoFocus: boolean;
  focusSection?: "narration" | "dialogue";
  onChange: (opening: NodeOpening) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onPreview: AuthorWorkspaceContext["runtime"]["preview"];
}) {
  const showDialogue = Boolean(conversationCharacterId || opening.dialogueText.trim());
  const dialogueLabel = conversationName
    ? `${conversationName.toUpperCase()} SAYS`
    : "DIALOGUE — SET A CONVERSATION CHARACTER";
  const snippet = nodeOpeningSnippet(opening, 72) || "No entry text";
  return <details className="guided-section" open={total === 1 || autoFocus}>
    <summary className="node-opening-summary">
      <strong>{index + 1}. {snippet}</strong>
      <small className="node-opening-notation">{notationForNodeOpeningCondition(opening.condition)}</small>
    </summary>
    <div className="node-focused-form">
      <OutcomeConditionEditor
        condition={opening.condition}
        snapshot={snapshot}
        onChange={(condition) => onChange({ ...opening, condition })}
        language="time"
      />
      <div className={`narrative-prose-grid${showDialogue ? " has-dialogue" : ""}`}>
        <AuthoredTextEditor
          value={{ text: opening.narrationText, performance: opening.narrationPerformance }}
          snapshot={snapshot}
          playState={playState}
          label="NARRATION"
          rows={6}
          autoFocus={autoFocus && (focusSection === "narration" || (!focusSection && !conversationCharacterId))}
          onChange={(value) => onChange({ ...opening, narrationText: value.text, narrationPerformance: value.performance })}
          onPreview={(value) => onPreview({ text: value.text, performance: value.performance, speakerId: null })}
        />
        {showDialogue ? <AuthoredTextEditor
          value={{ text: opening.dialogueText, performance: opening.dialoguePerformance }}
          snapshot={snapshot}
          playState={playState}
          label={dialogueLabel}
          rows={6}
          autoFocus={autoFocus && (focusSection === "dialogue" || (!focusSection && Boolean(conversationCharacterId)))}
          onChange={(value) => onChange({ ...opening, dialogueText: value.text, dialoguePerformance: value.performance })}
          onPreview={(value) => onPreview({ text: value.text, performance: value.performance, speakerId: conversationCharacterId })}
        /> : null}
      </div>
      <div className="guided-response-actions">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)}>[MOVE UP]</button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(1)}>[MOVE DOWN]</button>
        <button type="button" disabled={total === 1 || references > 0} onClick={onRemove}>[REMOVE OPENING]</button>
      </div>
      {references > 0 ? <small>This opening is explicitly targeted by {references} response{references === 1 ? "" : "s"}. Reassign those links before removing it.</small> : null}
    </div>
  </details>;
}

export const nodeWorkspace = defineAuthorWorkspace<NodeWorkspaceDraft>({
  id: "narrative.node",
  matches(route) {
    return route.type === "feature"
      && route.feature === "narrative"
      && route.workspace === "node"
      && (Boolean(route.data?.nodeId) || route.data?.resourceTask === "node");
  },
  createDraft(route, context) {
    const node = nodeForRoute(route, context);
    if (!node) throw new Error("Node workspace opened without a node or create-resource task.");
    return {
      node: {
        ...normalizeNodeContext(node),
        authorLabel: node.authorLabel,
        openings: structuredClone(node.openings),
        anchor: { ...nodeAnchor(node) },
        entryEffects: structuredClone(node.entryEffects ?? []),
      },
    };
  },
  buildSpec({ draft, setDraft, context, route }) {
    const data = routeData(route);
    const locationMode = nodeLocationMode(draft.node);
    const conversationMode = nodeConversationMode(draft.node);
    const anchor = nodeAnchor(draft.node);
    const entryEffects = draft.node.entryEffects ?? [];
    const nodeExists = context.snapshot.nodes.some((node) => node.id === draft.node.id);
    const focusedOpeningId = data?.openingId;
    const focusedSection = data?.section === "narration" || data?.section === "dialogue"
      ? data.section
      : undefined;

    const traversalIndex = context.playState.traversal.lastIndexOf(draft.node.id);
    const inheritContextFromNodeId = data?.inheritContextFromNodeId;
    const inheritedFromTraversalIndex = inheritContextFromNodeId
      ? context.playState.traversal.lastIndexOf(inheritContextFromNodeId)
      : -1;
    const snapshotWithDraft = {
      ...context.snapshot,
      nodes: nodeExists
        ? context.snapshot.nodes.map((node) => node.id === draft.node.id ? draft.node : node)
        : [...context.snapshot.nodes, draft.node],
    };

    const contextualTraversal = inheritedFromTraversalIndex >= 0
      ? [...context.playState.traversal.slice(0, inheritedFromTraversalIndex + 1), draft.node.id]
      : traversalIndex >= 0
        ? context.playState.traversal.slice(0, traversalIndex + 1)
        : null;
    const currentTraversalState = contextualTraversal ? {
      ...context.playState,
      currentNodeId: draft.node.id,
      currentNodeOpeningId: null,
      traversal: contextualTraversal,
    } : null;
    const inheritedTraversal = contextualTraversal?.slice(0, -1) ?? [];
    const inheritedTraversalState = inheritedTraversal.length ? {
      ...context.playState,
      currentNodeId: inheritedTraversal[inheritedTraversal.length - 1],
      currentNodeOpeningId: null,
      traversal: inheritedTraversal,
    } : null;
    const resolvedContext = currentTraversalState
      ? resolveActiveNodeContext(snapshotWithDraft, currentTraversalState)
      : null;
    const inheritedContext = inheritedTraversalState
      ? resolveActiveNodeContext(snapshotWithDraft, inheritedTraversalState)
      : null;
    const resolvedAnchor = currentTraversalState
      ? resolveActiveNodeAnchor(snapshotWithDraft, currentTraversalState)
      : null;
    const inheritedAnchor = inheritedTraversalState
      ? resolveActiveNodeAnchor(snapshotWithDraft, inheritedTraversalState)
      : null;
    const pathContextKnown = Boolean(currentTraversalState);

    const resolvedLocationId = resolvedContext?.location?.locationId
      ?? (locationMode === "set" ? draft.node.locationId : null);
    const resolvedConversationId = resolvedContext?.conversation?.characterId
      ?? (conversationMode === "set" ? nodeConversationCharacterId(draft.node) : null);
    const locationName = entityName(context, resolvedLocationId, "location");
    const conversationName = entityName(context, resolvedConversationId, "character");
    const locationLabel = locationMode === "clear"
      ? "NO LOCATION"
      : locationName
        ? locationName
        : locationMode === "continue"
          ? pathContextKnown ? "NO LOCATION ON THIS PATH" : "LOCATION AT RUNTIME"
          : "LOCATION NEEDED";
    const conversationLabel = conversationMode === "clear"
      ? "NO CONVERSATION"
      : conversationName
        ? `WITH ${conversationName}`
        : conversationMode === "continue"
          ? pathContextKnown ? "NO CONVERSATION ON THIS PATH" : "CONVERSATION AT RUNTIME"
          : "CHARACTER NEEDED";

    const locationReferenceId = locationMode === "set"
      ? draft.node.locationId ?? ""
      : locationMode === "continue" ? inheritedContext?.location?.locationId ?? "" : "";
    const conversationReferenceId = conversationMode === "set"
      ? nodeConversationCharacterId(draft.node) ?? ""
      : conversationMode === "continue" ? inheritedContext?.conversation?.characterId ?? "" : "";

    const nodeInteractions = context.snapshot.interactions.filter((interaction) => interaction.sourceNodeId === draft.node.id);
    const validInputs = nodeInteractions.filter((interaction) => interaction.matchMode !== "fallback");
    const invalidInput = nodeInteractions.find((interaction) => interaction.matchMode === "fallback");
    const inputSummary = `${validInputs.length} valid input${validInputs.length === 1 ? "" : "s"} · ${invalidInput ? "invalid response set" : "no invalid response"}`;
    const inputRows = nodeExists ? <NodeInputList
      snapshot={context.snapshot}
      nodeId={draft.node.id}
      nodeNumber={draft.node.nodeNumber}
      persist={context.persist}
      invalidInput={invalidInput}
      onOpenInput={(interactionId) => context.pushTask(inputRoute(draft.node.id, interactionId))}
      onOpenInvalid={() => context.pushTask(inputRoute(draft.node.id, invalidInput?.id, true))}
    /> : null;

    const updateOpening = (openingId: string, opening: NodeOpening) => setDraft((current) => ({
      ...current,
      node: {
        ...current.node,
        openings: current.node.openings.map((candidate) => candidate.id === openingId ? opening : candidate),
      },
    }));
    const moveOpening = (openingId: string, direction: -1 | 1) => setDraft((current) => {
      const openings = [...current.node.openings].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const index = openings.findIndex((opening) => opening.id === openingId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= openings.length) return current;
      [openings[index], openings[target]] = [openings[target], openings[index]];
      return { ...current, node: { ...current.node, openings: openings.map((opening, order) => ({ ...opening, order })) } };
    });
    const removeOpening = (openingId: string) => setDraft((current) => ({
      ...current,
      node: {
        ...current.node,
        openings: current.node.openings.filter((opening) => opening.id !== openingId).map((opening, order) => ({ ...opening, order })),
      },
    }));
    const orderedOpenings = [...draft.node.openings].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

    return {
      id: "narrative.node",
      title: nodeAuthorTitle(draft.node).toUpperCase(),
      blocks: [
        {
          type: "custom",
          id: "node-context-strip",
          role: "specialized-control",
          content: <details className="node-context-strip">
            <summary>
              <span className="node-context-primary">{locationLabel} <span aria-hidden="true">·</span> {conversationLabel}</span>
              <span className="node-context-change">[CHANGE]</span>
            </summary>
            <div className="node-context-fields">
              <div className="node-context-cell">
                <strong>WHERE IS THIS HAPPENING?</strong>
                <ReferenceField kind="location" value={locationReferenceId} allowEmpty={false} onChange={(locationId) => setDraft((current) => ({ ...current, node: { ...current.node, locationMode: "set", locationId: locationId || null } }))} placeholder="choose location" />
                <div className="node-context-actions">
                  <button type="button" disabled={locationMode === "continue"} onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, locationMode: "continue", locationId: null } }))}>[CONTINUE FROM PATH]</button>
                  <button type="button" disabled={locationMode === "clear"} onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, locationMode: "clear", locationId: null } }))}>[NO LOCATION]</button>
                </div>
              </div>
              <div className="node-context-cell">
                <strong>IS THIS A CONVERSATION? IF SO, WITH WHO?</strong>
                <ReferenceField kind="character" value={conversationReferenceId} allowEmpty={false} onChange={(characterId) => setDraft((current) => ({ ...current, node: { ...current.node, conversationMode: "set", conversationCharacterId: characterId || null } }))} placeholder="choose character" />
                <div className="node-context-actions">
                  <button type="button" disabled={conversationMode === "continue"} onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, conversationMode: "continue", conversationCharacterId: null } }))}>[CONTINUE FROM PATH]</button>
                  <button type="button" disabled={conversationMode === "clear"} onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, conversationMode: "clear", conversationCharacterId: null } }))}>[END CONVERSATION]</button>
                </div>
              </div>
            </div>
          </details>,
        },
        {
          type: "custom",
          id: "node-openings",
          role: "specialized-control",
          content: <section className="guided-section">
            <h3>ENTRY RESPONSES</h3>
            <small>AUTO entry evaluates these in order and uses the first matching condition. Other responses may explicitly target one opening by its stable identity.</small>
            {orderedOpenings.map((opening, index) => {
              const references = context.snapshot.interactions.reduce((count, interaction) => count + interaction.outcomes.filter((outcome) => outcome.destination?.nodeId === draft.node.id && outcome.destination.openingId === opening.id).length, 0);
              const focused = focusedOpeningId === opening.id;
              return <OpeningEditor
                key={opening.id}
                opening={opening}
                index={index}
                total={orderedOpenings.length}
                snapshot={snapshotWithDraft}
                playState={currentTraversalState ?? context.playState}
                conversationName={conversationName}
                conversationCharacterId={resolvedConversationId}
                references={references}
                autoFocus={focusedOpeningId ? focused : !data?.nodeId && index === 0}
                focusSection={focused ? focusedSection : undefined}
                onChange={(value) => updateOpening(opening.id, value)}
                onMove={(direction) => moveOpening(opening.id, direction)}
                onRemove={() => removeOpening(opening.id)}
                onPreview={context.runtime.preview}
              />;
            })}
            <button type="button" className="guided-add" onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, openings: [...current.node.openings, createNodeOpening(current.node.openings.length)] } }))}>[+ ADD ENTRY RESPONSE]</button>
          </section>,
        },
        {
          type: "section",
          id: "node-input-handling",
          label: "INPUT HANDLING",
          summary: inputSummary,
          children: nodeExists ? [{ type: "custom", id: "node-input-list", role: "results", content: inputRows }] : [{ type: "status", id: "node-input-save-first", tone: "info", text: "Save this Node before configuring its node-specific inputs and invalid response." }],
        },
        {
          type: "custom",
          id: "node-anchor",
          role: "specialized-control",
          content: <details className="node-anchor-strip">
            <summary>
              <span>ANCHOR <strong>{anchor.mode === "set" ? clip(anchor.text) || "text needed" : anchor.mode === "clear" ? "—" : resolvedAnchor?.text ? clip(resolvedAnchor.text) : "—"}</strong></span>
              <span>[EDIT]</span>
            </summary>
            <div className="node-anchor-body">
              {anchor.mode === "set" ? <ValueMentionField snapshot={context.snapshot} playState={context.playState} multiline rows={3} value={anchor.text} placeholder="Persistent context shown beneath the player input" onValueChange={(text) => setDraft((current) => ({ ...current, node: { ...current.node, anchor: { mode: "set", text } } }))} /> : <small>{anchor.mode === "continue" ? `Inherited from the path${inheritedAnchor?.text ? ` — ${clip(inheritedAnchor.text)}` : " — none"}.` : "No anchor is active after this Node."}</small>}
              <div className="node-context-actions">
                <button type="button" disabled={anchor.mode === "set"} onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, anchor: { mode: "set", text: inheritedAnchor?.text ?? "" } } }))}>[SET ANCHOR]</button>
                <button type="button" disabled={anchor.mode === "continue"} onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, anchor: { mode: "continue", text: "" } } }))}>[CONTINUE FROM PATH]</button>
                <button type="button" disabled={anchor.mode === "clear"} onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, anchor: { mode: "clear", text: "" } } }))}>[CLEAR]</button>
              </div>
            </div>
          </details>,
        },
        {
          type: "disclosure",
          id: "node-entry-effects",
          label: "ON ENTER",
          summary: entryEffects.length ? `${entryEffects.length} effect${entryEffects.length === 1 ? "" : "s"}` : "No entry effects",
          children: [{ type: "custom", id: "node-entry-effects-editor", role: "specialized-control", content: <div className="node-focused-form">
            <small>These effects run whenever player traversal enters this Node. They use the same canonical effect definitions as responses, rules, and operations.</small>
            <EffectsEditor effects={entryEffects} snapshot={context.snapshot} onChange={(effects) => setDraft((current) => ({ ...current, node: { ...current.node, entryEffects: effects } }))} />
          </div> }],
        },
        {
          type: "disclosure",
          id: "node-organization",
          label: "ORGANIZATION",
          summary: draft.node.authorLabel.trim() || (draft.node.tags.length ? `${draft.node.tags.length} tag${draft.node.tags.length === 1 ? "" : "s"}` : "Untitled"),
          children: [{ type: "custom", id: "node-organization-fields", role: "specialized-control", content: <div className="node-focused-form">
            <label>NODE NAME <input value={draft.node.authorLabel} placeholder={`Node #${draft.node.nodeNumber}`} onChange={(event) => setDraft((current) => ({ ...current, node: { ...current.node, authorLabel: event.target.value } }))} /></label>
            <small>Private author-facing name. Renaming it never changes entry text or links.</small>
            <label>AUTHOR TAGS <input value={draft.node.tags.join(", ")} onChange={(event) => setDraft((current) => ({ ...current, node: { ...current.node, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } }))} /></label>
          </div> }],
        },
        {
          type: "choice",
          id: "node-ending",
          label: "ENDING",
          value: draft.node.ending ? "ending" : "continues",
          onChange: (value) => setDraft((current) => ({ ...current, node: { ...current.node, ending: value === "ending" } })),
          presentation: "segmented",
          options: [
            { value: "continues", label: "STORY CONTINUES" },
            { value: "ending", label: "INTENTIONAL ENDING", help: "Marks this node as an authored ending." },
          ],
        },
      ],
    };
  },
  canSave({ draft }) {
    const anchor = nodeAnchor(draft.node);
    const locationMode = nodeLocationMode(draft.node);
    const conversationMode = nodeConversationMode(draft.node);
    const dialogueExists = draft.node.openings.some((opening) => opening.dialogueText.trim());
    return draft.node.openings.length > 0
      && (anchor.mode !== "set" || Boolean(anchor.text.trim()))
      && (locationMode !== "set" || Boolean(draft.node.locationId))
      && (conversationMode !== "set" || Boolean(nodeConversationCharacterId(draft.node)))
      && !(conversationMode === "clear" && dialogueExists);
  },
  async save({ draft, context, route }) {
    const data = routeData(route);
    const anchor = nodeAnchor(draft.node);
    const node: GameNode = {
      ...normalizeNodeContext(draft.node),
      authorLabel: draft.node.authorLabel.trim(),
      openings: [...draft.node.openings].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((opening, order) => ({ ...opening, order })),
      anchor,
      entryEffects: draft.node.entryEffects ?? [],
    };
    const result = await context.persist(
      [{ type: "node.upsert", node }],
      `${data?.nodeId ? "Changed" : "Created"} node #${draft.node.nodeNumber}`,
    );
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return {
      accepted: true,
      draft: { node },
      completion: data?.resourceTask === "node" ? {
        type: "resource",
        kind: "node",
        id: draft.node.id,
        value: draft.node.id,
        label: nodeAuthorTitle(node),
      } : undefined,
    };
  },
});
