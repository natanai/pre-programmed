import { EffectsEditor } from "../../../author/EffectsEditor";
import type { AuthorWorkspaceContext } from "../../../author/features/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { ValueMentionField } from "../../../author/ValueMentionField";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { makeId } from "../../../engine/project/id";
import { resolveActiveNodeAnchor } from "../anchor";
import type { GameNode, NodeAnchor, NodeContextMode, TextPerformance } from "../model";
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
import "./nodeWorkspace.css";

type NodeWorkspaceDraft = {
  node: GameNode;
};

const CONTINUE_ANCHOR: NodeAnchor = { mode: "continue", text: "" };
const DEFAULT_TEXT_PERFORMANCE: TextPerformance = { charactersPerSecond: 18, cues: [] };

function nodeAnchor(node: GameNode): NodeAnchor {
  return node.anchor ?? CONTINUE_ANCHOR;
}

function nodeDialoguePerformance(node: GameNode): TextPerformance {
  return node.dialoguePerformance ?? DEFAULT_TEXT_PERFORMANCE;
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
    text: "",
    dialogueText: "",
    ending: false,
    tags: [],
    locationId: null,
    locationMode: "continue",
    conversationCharacterId: null,
    conversationMode: "continue",
    anchor: { ...CONTINUE_ANCHOR },
    entryEffects: [],
    performance: { ...DEFAULT_TEXT_PERFORMANCE, cues: [] },
    dialoguePerformance: { ...DEFAULT_TEXT_PERFORMANCE, cues: [] },
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
        dialogueText: node.dialogueText ?? "",
        dialoguePerformance: structuredClone(nodeDialoguePerformance(node)),
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

    const traversalIndex = context.playState.traversal.lastIndexOf(draft.node.id);
    const snapshotWithDraft = nodeExists ? {
      ...context.snapshot,
      nodes: context.snapshot.nodes.map((node) => node.id === draft.node.id ? draft.node : node),
    } : context.snapshot;
    const currentTraversalState = traversalIndex >= 0 ? {
      ...context.playState,
      currentNodeId: draft.node.id,
      traversal: context.playState.traversal.slice(0, traversalIndex + 1),
    } : null;
    const inheritedTraversalState = traversalIndex > 0 ? {
      ...context.playState,
      currentNodeId: context.playState.traversal[traversalIndex - 1],
      traversal: context.playState.traversal.slice(0, traversalIndex),
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

    const resolvedLocationId = resolvedContext?.location?.locationId
      ?? (locationMode === "set" ? draft.node.locationId : null);
    const resolvedConversationId = resolvedContext?.conversation?.characterId
      ?? (conversationMode === "set" ? nodeConversationCharacterId(draft.node) : null);
    const locationName = entityName(context, resolvedLocationId, "location");
    const conversationName = entityName(context, resolvedConversationId, "character");
    const locationLabel = locationMode === "clear"
      ? "NO LOCATION"
      : locationName || (locationMode === "continue" ? "LOCATION AT RUNTIME" : "LOCATION NEEDED");
    const conversationLabel = conversationMode === "clear"
      ? "NO CONVERSATION"
      : conversationName ? `WITH ${conversationName}` : (conversationMode === "continue" ? "NO CONVERSATION ON THIS PATH" : "CHARACTER NEEDED");

    const locationReferenceId = locationMode === "set"
      ? draft.node.locationId ?? ""
      : locationMode === "continue" ? inheritedContext?.location?.locationId ?? "" : "";
    const conversationReferenceId = conversationMode === "set"
      ? nodeConversationCharacterId(draft.node) ?? ""
      : conversationMode === "continue" ? inheritedContext?.conversation?.characterId ?? "" : "";

    const dialogueText = draft.node.dialogueText ?? "";
    const showDialogueEditor = Boolean(resolvedConversationId || dialogueText.trim());
    const dialogueLabel = conversationName
      ? `${conversationName.toUpperCase()} SAYS`
      : "DIALOGUE — SET A CONVERSATION CHARACTER";

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

    return {
      id: "narrative.node",
      title: `NODE #${draft.node.nodeNumber}`,
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
                <ReferenceField
                  kind="location"
                  value={locationReferenceId}
                  allowEmpty={false}
                  onChange={(locationId) => setDraft((current) => ({
                    ...current,
                    node: { ...current.node, locationMode: "set", locationId: locationId || null },
                  }))}
                  placeholder="choose location"
                />
                <div className="node-context-actions">
                  <button
                    type="button"
                    disabled={locationMode === "continue"}
                    onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, locationMode: "continue", locationId: null } }))}
                  >[CONTINUE FROM PATH]</button>
                  <button
                    type="button"
                    disabled={locationMode === "clear"}
                    onClick={() => setDraft((current) => ({ ...current, node: { ...current.node, locationMode: "clear", locationId: null } }))}
                  >[NO LOCATION]</button>
                </div>
              </div>

              <div className="node-context-cell">
                <strong>IS THIS A CONVERSATION? IF SO, WITH WHO?</strong>
                <ReferenceField
                  kind="character"
                  value={conversationReferenceId}
                  allowEmpty={false}
                  onChange={(characterId) => setDraft((current) => ({
                    ...current,
                    node: {
                      ...current.node,
                      conversationMode: "set",
                      conversationCharacterId: characterId || null,
                    },
                  }))}
                  placeholder="choose character"
                />
                <div className="node-context-actions">
                  <button
                    type="button"
                    disabled={conversationMode === "continue"}
                    onClick={() => setDraft((current) => ({
                      ...current,
                      node: { ...current.node, conversationMode: "continue", conversationCharacterId: null },
                    }))}
                  >[CONTINUE FROM PATH]</button>
                  <button
                    type="button"
                    disabled={conversationMode === "clear"}
                    onClick={() => setDraft((current) => ({
                      ...current,
                      node: { ...current.node, conversationMode: "clear", conversationCharacterId: null },
                    }))}
                  >[END CONVERSATION]</button>
                </div>
              </div>
            </div>
          </details>,
        },
        {
          type: "custom",
          id: "node-prose",
          role: "specialized-control",
          content: <div className={`narrative-prose-grid${showDialogueEditor ? " has-dialogue" : ""}`}>
            <AuthoredTextEditor
              value={{ text: draft.node.text, performance: draft.node.performance }}
              snapshot={context.snapshot}
              playState={context.playState}
              label="NARRATION"
              rows={6}
              autoFocus={!data?.nodeId && !resolvedConversationId}
              onChange={(value) => setDraft((current) => ({
                ...current,
                node: { ...current.node, text: value.text, performance: value.performance },
              }))}
              onPreview={(value) => context.runtime.preview({
                text: value.text,
                performance: value.performance,
                speakerId: null,
              })}
            />
            {showDialogueEditor ? <AuthoredTextEditor
              value={{ text: dialogueText, performance: nodeDialoguePerformance(draft.node) }}
              snapshot={context.snapshot}
              playState={context.playState}
              label={dialogueLabel}
              rows={6}
              autoFocus={!data?.nodeId && Boolean(resolvedConversationId)}
              onChange={(value) => setDraft((current) => ({
                ...current,
                node: { ...current.node, dialogueText: value.text, dialoguePerformance: value.performance },
              }))}
              onPreview={(value) => context.runtime.preview({
                text: value.text,
                performance: value.performance,
                speakerId: resolvedConversationId,
              })}
            /> : null}
          </div>,
        },
        {
          type: "section",
          id: "node-input-handling",
          label: "INPUT HANDLING",
          summary: inputSummary,
          children: nodeExists ? [{
            type: "custom",
            id: "node-input-list",
            role: "results",
            content: inputRows,
          }] : [{
            type: "status",
            id: "node-input-save-first",
            tone: "info",
            text: "Save this Node before configuring its node-specific inputs and invalid response.",
          }],
        },
        {
          type: "custom",
          id: "node-anchor",
          role: "specialized-control",
          content: <details className="node-anchor-strip">
            <summary>
              <span>ANCHOR <strong>{anchor.mode === "set"
                ? clip(anchor.text) || "text needed"
                : anchor.mode === "clear"
                  ? "—"
                  : resolvedAnchor?.text ? clip(resolvedAnchor.text) : "—"}</strong></span>
              <span>[EDIT]</span>
            </summary>
            <div className="node-anchor-body">
              {anchor.mode === "set" ? <ValueMentionField
                snapshot={context.snapshot}
                playState={context.playState}
                multiline
                rows={3}
                value={anchor.text}
                placeholder="Persistent context shown beneath the player input"
                onValueChange={(text) => setDraft((current) => ({
                  ...current,
                  node: { ...current.node, anchor: { mode: "set", text } },
                }))}
              /> : <small>{anchor.mode === "continue"
                ? `Inherited from the path${inheritedAnchor?.text ? ` — ${clip(inheritedAnchor.text)}` : " — none"}.`
                : "No anchor is active after this Node."}</small>}
              <div className="node-context-actions">
                <button
                  type="button"
                  disabled={anchor.mode === "set"}
                  onClick={() => setDraft((current) => ({
                    ...current,
                    node: {
                      ...current.node,
                      anchor: { mode: "set", text: inheritedAnchor?.text ?? "" },
                    },
                  }))}
                >[SET ANCHOR]</button>
                <button
                  type="button"
                  disabled={anchor.mode === "continue"}
                  onClick={() => setDraft((current) => ({
                    ...current,
                    node: { ...current.node, anchor: { mode: "continue", text: "" } },
                  }))}
                >[CONTINUE FROM PATH]</button>
                <button
                  type="button"
                  disabled={anchor.mode === "clear"}
                  onClick={() => setDraft((current) => ({
                    ...current,
                    node: { ...current.node, anchor: { mode: "clear", text: "" } },
                  }))}
                >[CLEAR]</button>
              </div>
            </div>
          </details>,
        },
        {
          type: "disclosure",
          id: "node-entry-effects",
          label: "ON ENTER",
          summary: entryEffects.length ? `${entryEffects.length} effect${entryEffects.length === 1 ? "" : "s"}` : "No entry effects",
          children: [{
            type: "custom",
            id: "node-entry-effects-editor",
            role: "specialized-control",
            content: <div className="node-focused-form">
              <small>These effects run whenever player traversal enters this Node. They use the same canonical effect definitions as responses, rules, and operations.</small>
              <EffectsEditor
                effects={entryEffects}
                snapshot={context.snapshot}
                onChange={(effects) => setDraft((current) => ({
                  ...current,
                  node: { ...current.node, entryEffects: effects },
                }))}
              />
            </div>,
          }],
        },
        {
          type: "disclosure",
          id: "node-organization",
          label: "ORGANIZATION",
          summary: draft.node.tags.length ? `${draft.node.tags.length} tag${draft.node.tags.length === 1 ? "" : "s"}` : "No tags",
          children: [{
            type: "custom",
            id: "node-organization-fields",
            role: "specialized-control",
            content: <div className="node-focused-form">
              <label>AUTHOR TAGS <input value={draft.node.tags.join(", ")} onChange={(event) => setDraft((current) => ({ ...current, node: { ...current.node, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } }))} /></label>
              <small>Tags are for Author search and organization. They do not change gameplay.</small>
            </div>,
          }],
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
    return (anchor.mode !== "set" || Boolean(anchor.text.trim()))
      && (locationMode !== "set" || Boolean(draft.node.locationId))
      && (conversationMode !== "set" || Boolean(nodeConversationCharacterId(draft.node)))
      && !(conversationMode === "clear" && Boolean(draft.node.dialogueText?.trim()));
  },
  async save({ draft, context, route }) {
    const data = routeData(route);
    const anchor = nodeAnchor(draft.node);
    const node = {
      ...normalizeNodeContext(draft.node),
      dialogueText: draft.node.dialogueText ?? "",
      dialoguePerformance: nodeDialoguePerformance(draft.node),
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
        label: `Node #${draft.node.nodeNumber}`,
      } : undefined,
    };
  },
});
