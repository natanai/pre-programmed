import type { AuthorWorkspaceContext } from "../../../author/features/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { ValueMentionField } from "../../../author/ValueMentionField";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { makeId } from "../../../engine/project/id";
import { nodeLocationMode, normalizeNodeLocationContext } from "../locationContext";
import type { GameNode, NodeAnchor, NodeLocationMode } from "../model";
import { nextNodeNumber } from "../nodeNumber";
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
        ...normalizeNodeLocationContext(node),
        anchor: { ...nodeAnchor(node) },
      },
    };
  },
  buildSpec({ draft, setDraft, context, route }) {
    const data = routeData(route);
    const speaker = context.snapshot.entities.find((entity) => entity.id === draft.node.characterId)?.name ?? "Narration";
    const locationMode = nodeLocationMode(draft.node);
    const selectedLocation = draft.node.locationId
      ? context.snapshot.entities.find((entity) => entity.id === draft.node.locationId && entity.type === "location")
      : undefined;
    const locationSummary = locationMode === "set"
      ? `Set ${selectedLocation?.name || selectedLocation?.key || "location needed"}`
      : locationMode === "clear" ? "Clear location" : "Continue location";
    const anchor = nodeAnchor(draft.node);
    const anchorSummary = anchor.mode === "set"
      ? (anchor.text.trim() || "Set — text needed")
      : anchor.mode === "clear" ? "Clear the active anchor" : "Continue the active anchor";
    const nodeExists = context.snapshot.nodes.some((node) => node.id === draft.node.id);
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
          <strong>{interaction.wording || interaction.aliases[0] || "UNTITLED INPUT"}</strong>
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
          type: "disclosure",
          id: "node-context",
          label: "CONTEXT",
          summary: `${speaker} · ${locationSummary}${draft.node.tags.length ? ` · ${draft.node.tags.length} tag${draft.node.tags.length === 1 ? "" : "s"}` : ""}`,
          children: [{
            type: "custom",
            id: "node-context-fields",
            role: "resource-picker",
            content: <div className="node-focused-form">
              <label>CHARACTER / SPEAKER <ReferenceField kind="character" value={draft.node.characterId ?? ""} onChange={(characterId) => setDraft((current) => ({ ...current, node: { ...current.node, characterId: characterId || null } }))} placeholder="none / narration" /></label>
              <label>LOCATION BEHAVIOR
                <select
                  value={locationMode}
                  onChange={(event) => {
                    const mode = event.target.value as NodeLocationMode;
                    setDraft((current) => ({
                      ...current,
                      node: {
                        ...current.node,
                        locationMode: mode,
                        locationId: mode === "set" ? current.node.locationId : null,
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
                  ? "Keeps the active location from earlier in this run. This is the default for new Nodes."
                  : "Clears the active location when the player reaches this Node."}</small>}
              <label>TAGS <input value={draft.node.tags.join(", ")} onChange={(event) => setDraft((current) => ({ ...current, node: { ...current.node, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } }))} /></label>
            </div>,
          }],
        },
        {
          type: "disclosure",
          id: "node-anchor",
          label: "ANCHOR",
          summary: anchorSummary,
          children: [{
            type: "custom",
            id: "node-anchor-fields",
            role: "specialized-control",
            content: <div className="node-focused-form node-anchor-editor">
              <label>BEHAVIOR
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
                ? "Keeps the most recently set anchor. This is the default for branching nodes."
                : "Removes the active anchor when the player reaches this node."}</small>}
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
    return (anchor.mode !== "set" || Boolean(anchor.text.trim()))
      && (locationMode !== "set" || Boolean(draft.node.locationId));
  },
  async save({ draft, context, route }) {
    const data = routeData(route);
    const anchor = nodeAnchor(draft.node);
    const node = { ...normalizeNodeLocationContext(draft.node), anchor };
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
