import type { AuthorWorkspaceContext } from "../../../author/features/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { ValueMentionField } from "../../../author/ValueMentionField";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { makeId } from "../../../engine/project/id";
import { resolveActiveNodeAnchor } from "../anchor";
import type { GameNode, NodeAnchor, NodeCharacterContext, NodeContextMode } from "../model";
import { nextNodeNumber } from "../nodeNumber";
import {
  nodeConversation,
  nodeLocationMode,
  nodePresentCharacters,
  normalizeNodeSceneContext,
  resolveActiveNodeSceneContext,
} from "../sceneContext";
import { AuthoredTextEditor } from "./AuthoredTextEditor";
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
    text: "",
    ending: false,
    tags: [],
    characterId: null,
    locationId: null,
    locationMode: "continue",
    presentCharacters: { mode: "continue", characterIds: [] },
    conversation: { mode: "continue", characterIds: [] },
    anchor: { ...CONTINUE_ANCHOR },
    performance: { charactersPerSecond: 18, cues: [] },
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

function clip(value: string, length = 38) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function characterNames(context: AuthorWorkspaceContext, ids: readonly string[]) {
  return ids.map((id) => {
    const entity = context.snapshot.entities.find((candidate) => candidate.id === id && candidate.type === "character");
    return entity?.name || entity?.key || "missing character";
  });
}

function CharacterContextEditor({
  label,
  value,
  inheritedIds,
  context,
  onChange,
}: {
  label: string;
  value: NodeCharacterContext;
  inheritedIds: readonly string[];
  context: AuthorWorkspaceContext;
  onChange: (value: NodeCharacterContext) => void;
}) {
  const inheritedNames = characterNames(context, inheritedIds);
  return <div className="node-scene-context-group">
    <label>{label} BEHAVIOR
      <select
        value={value.mode}
        onChange={(event) => {
          const mode = event.target.value as NodeContextMode;
          onChange({
            mode,
            characterIds: mode === "set" ? [...(value.characterIds.length ? value.characterIds : inheritedIds)] : [],
          });
        }}
      >
        <option value="continue">CONTINUE</option>
        <option value="set">SET</option>
        <option value="clear">CLEAR</option>
      </select>
    </label>
    {value.mode === "set" ? <>
      <div className="node-scene-character-list">
        {value.characterIds.map((characterId, index) => <div className="node-scene-character-row" key={`${characterId}-${index}`}>
          <ReferenceField
            kind="character"
            value={characterId}
            onChange={(nextId) => onChange({
              mode: "set",
              characterIds: value.characterIds
                .map((id, candidateIndex) => candidateIndex === index ? nextId : id)
                .filter(Boolean),
            })}
            placeholder="choose character"
          />
          <button
            type="button"
            className="node-scene-remove"
            aria-label={`Remove ${label.toLowerCase()} character`}
            onClick={() => onChange({
              mode: "set",
              characterIds: value.characterIds.filter((_, candidateIndex) => candidateIndex !== index),
            })}
          >×</button>
        </div>)}
      </div>
      <label>+ CHARACTER
        <ReferenceField
          kind="character"
          value=""
          onChange={(characterId) => {
            if (!characterId || value.characterIds.includes(characterId)) return;
            onChange({ mode: "set", characterIds: [...value.characterIds, characterId] });
          }}
          placeholder="choose character"
        />
      </label>
      {!value.characterIds.length ? <small>Set needs at least one character, or use Clear for none.</small> : null}
    </> : <small>{value.mode === "continue"
      ? `Keeps the characters established by the path${inheritedNames.length ? ` — ${inheritedNames.join(", ")}` : ""}. New branching Nodes default to Continue.`
      : "Clears this part of the scene when the player reaches this Node."}</small>}
  </div>;
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
        ...normalizeNodeSceneContext(node),
        anchor: { ...nodeAnchor(node) },
      },
    };
  },
  buildSpec({ draft, setDraft, context, route }) {
    const data = routeData(route);
    const speaker = context.snapshot.entities.find((entity) => entity.id === draft.node.characterId)?.name ?? "Narration";
    const locationMode = nodeLocationMode(draft.node);
    const presentCharacters = nodePresentCharacters(draft.node);
    const conversation = nodeConversation(draft.node);
    const anchor = nodeAnchor(draft.node);
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
    const resolvedScene = currentTraversalState
      ? resolveActiveNodeSceneContext(snapshotWithDraft, currentTraversalState)
      : null;
    const inheritedScene = inheritedTraversalState
      ? resolveActiveNodeSceneContext(snapshotWithDraft, inheritedTraversalState)
      : null;
    const resolvedAnchor = currentTraversalState
      ? resolveActiveNodeAnchor(snapshotWithDraft, currentTraversalState)
      : null;

    const selectedLocation = draft.node.locationId
      ? context.snapshot.entities.find((entity) => entity.id === draft.node.locationId && entity.type === "location")
      : undefined;
    const resolvedLocation = resolvedScene?.location
      ? context.snapshot.entities.find((entity) => entity.id === resolvedScene.location?.locationId && entity.type === "location")
      : undefined;
    const locationSummary = locationMode === "set"
      ? `Set — ${selectedLocation?.name || selectedLocation?.key || "location needed"}`
      : locationMode === "clear"
        ? "Clear location"
        : resolvedScene
          ? `Continue — ${resolvedLocation?.name || resolvedLocation?.key || "none"}`
          : "Continue location at runtime";

    const presentNames = resolvedScene?.presentCharacters
      ? characterNames(context, resolvedScene.presentCharacters.characterIds)
      : [];
    const presentSummary = presentCharacters.mode === "set"
      ? `Set — ${characterNames(context, presentCharacters.characterIds).join(", ") || "characters needed"}`
      : presentCharacters.mode === "clear"
        ? "Clear characters present"
        : resolvedScene
          ? `Continue — ${presentNames.join(", ") || "none"}`
          : "Continue characters at runtime";

    const conversationNames = resolvedScene?.conversation
      ? characterNames(context, resolvedScene.conversation.characterIds)
      : [];
    const conversationSummary = conversation.mode === "set"
      ? `Set — ${characterNames(context, conversation.characterIds).join(", ") || "characters needed"}`
      : conversation.mode === "clear"
        ? "End conversation"
        : resolvedScene
          ? `Continue — ${conversationNames.join(", ") || "none"}`
          : "Continue conversation at runtime";

    const anchorSummary = anchor.mode === "set"
      ? (anchor.text.trim() || "Set — text needed")
      : anchor.mode === "clear"
        ? "Clear anchor"
        : currentTraversalState
          ? `Continue — ${resolvedAnchor?.text ? clip(resolvedAnchor.text) : "none"}`
          : "Continue anchor at runtime";

    const sceneSummary = resolvedScene && currentTraversalState
      ? [
        resolvedLocation?.name || resolvedLocation?.key || "no location",
        `${presentNames.length} present`,
        conversationNames.length ? `with ${conversationNames.join(", ")}` : "no conversation",
        resolvedAnchor?.text ? `anchor: ${clip(resolvedAnchor.text, 28)}` : "no anchor",
      ].join(" · ")
      : [locationSummary, presentSummary, conversationSummary, anchorSummary].join(" · ");

    const nodeInteractions = context.snapshot.interactions.filter((interaction) => interaction.sourceNodeId === draft.node.id);
    const validInputs = nodeInteractions.filter((interaction) => interaction.matchMode !== "fallback");
    const invalidInput = nodeInteractions.find((interaction) => interaction.matchMode === "fallback");
    const inputSummary = `${validInputs.length} valid input${validInputs.length === 1 ? "" : "s"} · ${invalidInput ? "invalid response set" : "no invalid response"}`;
    const inputRows = nodeExists ? <div className="node-input-list">
      {validInputs.map((interaction) => <button
        type="button"
        className="node-input-link"
        key={interaction.id}
        onClick={() => context.pushTask(inputRoute(draft.node.id, interaction.id))}
      >
        <span>
          <strong>{interaction.matchMode === "capture" ? "CAPTURE PLAYER INPUT" : interaction.wording || interaction.aliases[0] || "UNTITLED INPUT"}</strong>
          <small>{interaction.outcomes.length} response{interaction.outcomes.length === 1 ? "" : "s"} · Node #{draft.node.nodeNumber}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>)}
      <button type="button" className="node-input-link" onClick={() => context.pushTask(inputRoute(draft.node.id))}>
        <span><strong>+ VALID INPUT</strong><small>Add player wording that works only at Node #{draft.node.nodeNumber}.</small></span>
        <span aria-hidden="true">›</span>
      </button>
      <button
        type="button"
        className="node-input-link"
        onClick={() => context.pushTask(inputRoute(draft.node.id, invalidInput?.id, true))}
      >
        <span>
          <strong>{invalidInput ? "INVALID INPUT RESPONSE" : "+ INVALID INPUT RESPONSE"}</strong>
          <small>Only for Node #{draft.node.nodeNumber}: what happens when player text matches nothing here.</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </div> : null;

    return {
      id: "narrative.node",
      title: `NODE #${draft.node.nodeNumber}`,
      blocks: [
        {
          type: "custom",
          id: "node-text",
          role: "specialized-control",
          content: <AuthoredTextEditor
            value={{ text: draft.node.text, performance: draft.node.performance }}
            snapshot={context.snapshot}
            playState={context.playState}
            label="NODE TEXT"
            rows={7}
            autoFocus={!data?.nodeId}
            onChange={(value) => setDraft((current) => ({
              ...current,
              node: { ...current.node, text: value.text, performance: value.performance },
            }))}
            onPreview={(value) => context.runtime.preview({
              text: value.text,
              performance: value.performance,
              speakerId: draft.node.characterId,
            })}
          />,
        },
        {
          type: "custom",
          id: "node-speaker",
          role: "resource-picker",
          content: <div className="node-focused-form node-speaker-editor">
            <label>SPEAKER <ReferenceField kind="character" value={draft.node.characterId ?? ""} onChange={(characterId) => setDraft((current) => ({ ...current, node: { ...current.node, characterId: characterId || null } }))} placeholder="none / narration" /></label>
            <small>{speaker === "Narration" ? "Narration" : speaker} presents this Node text. Speaker does not start, continue, or end a conversation.</small>
          </div>,
        },
        {
          type: "disclosure",
          id: "node-scene",
          label: "SCENE",
          summary: sceneSummary,
          children: [{
            type: "custom",
            id: "node-scene-fields",
            role: "resource-picker",
            content: <div className="node-focused-form node-scene-editor">
              <div className="node-scene-context-group">
                <label>LOCATION BEHAVIOR
                  <select
                    value={locationMode}
                    onChange={(event) => {
                      const mode = event.target.value as NodeContextMode;
                      setDraft((current) => ({
                        ...current,
                        node: {
                          ...current.node,
                          locationMode: mode,
                          locationId: mode === "set"
                            ? current.node.locationId || inheritedScene?.location?.locationId || null
                            : null,
                        },
                      }));
                    }}
                  >
                    <option value="continue">CONTINUE</option>
                    <option value="set">SET</option>
                    <option value="clear">CLEAR</option>
                  </select>
                </label>
                {locationMode === "set" ? <label>LOCATION <ReferenceField kind="location" value={draft.node.locationId ?? ""} onChange={(locationId) => setDraft((current) => ({ ...current, node: { ...current.node, locationMode: "set", locationId: locationId || null } }))} placeholder="choose location" /></label>
                  : <small>{locationMode === "continue"
                    ? `Keeps the location established by the path${resolvedLocation ? ` — ${resolvedLocation.name || resolvedLocation.key}` : ""}. New branching Nodes default to Continue.`
                    : "Clears the active location when the player reaches this Node."}</small>}
              </div>

              <CharacterContextEditor
                label="CHARACTERS PRESENT"
                value={presentCharacters}
                inheritedIds={inheritedScene?.presentCharacters?.characterIds ?? []}
                context={context}
                onChange={(value) => setDraft((current) => ({ ...current, node: { ...current.node, presentCharacters: value } }))}
              />

              <CharacterContextEditor
                label="CONVERSATION"
                value={conversation}
                inheritedIds={inheritedScene?.conversation?.characterIds ?? []}
                context={context}
                onChange={(value) => setDraft((current) => ({ ...current, node: { ...current.node, conversation: value } }))}
              />

              <div className="node-scene-context-group node-anchor-editor">
                <label>ANCHOR BEHAVIOR
                  <select
                    value={anchor.mode}
                    onChange={(event) => {
                      const mode = event.target.value as NodeAnchor["mode"];
                      setDraft((current) => ({
                        ...current,
                        node: { ...current.node, anchor: { ...nodeAnchor(current.node), mode } },
                      }));
                    }}
                  >
                    <option value="continue">CONTINUE</option>
                    <option value="set">SET</option>
                    <option value="clear">CLEAR</option>
                  </select>
                </label>
                {anchor.mode === "set" ? <label>ANCHOR TEXT
                  <ValueMentionField
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
                  />
                </label> : <small>{anchor.mode === "continue"
                  ? `Keeps the anchor established by the path${resolvedAnchor?.text ? ` — ${clip(resolvedAnchor.text)}` : ""}. It can be changed independently inside or outside conversations.`
                  : "Removes the active anchor when the player reaches this Node without changing the rest of the scene."}</small>}
              </div>
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
              <small>Tags are for Author search and organization. They do not establish scene context or change gameplay.</small>
            </div>,
          }],
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
    const presentCharacters = nodePresentCharacters(draft.node);
    const conversation = nodeConversation(draft.node);
    return (anchor.mode !== "set" || Boolean(anchor.text.trim()))
      && (locationMode !== "set" || Boolean(draft.node.locationId))
      && (presentCharacters.mode !== "set" || presentCharacters.characterIds.length > 0)
      && (conversation.mode !== "set" || conversation.characterIds.length > 0);
  },
  async save({ draft, context, route }) {
    const data = routeData(route);
    const anchor = nodeAnchor(draft.node);
    const node = { ...normalizeNodeSceneContext(draft.node), anchor };
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
