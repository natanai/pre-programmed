import type { AuthorWorkspaceContext } from "../../../author/features/types";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { makeId } from "../../../engine/project/id";
import type { GameNode } from "../model";
import { nextNodeNumber } from "../nodeNumber";
import { AuthoredTextEditor } from "./AuthoredTextEditor";
import "./nodeWorkspace.css";

type NodeWorkspaceDraft = {
  node: GameNode;
};

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
    performance: { charactersPerSecond: 18, cues: [] },
  } satisfies GameNode;
}

function routeData(route: AuthorTaskRoute) {
  return route.type === "feature" ? route.data : undefined;
}

function invalidInputRoute(nodeId: string, interactionId?: string): AuthorTaskRoute {
  return {
    type: "feature",
    feature: "narrative",
    workspace: "interaction",
    data: {
      sourceNodeId: nodeId,
      fallback: "true",
      ...(interactionId ? { interactionId } : {}),
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
    return { node };
  },
  buildSpec({ draft, setDraft, context, route }) {
    const data = routeData(route);
    const speaker = context.snapshot.entities.find((entity) => entity.id === draft.node.characterId)?.name ?? "Narration";
    const location = context.snapshot.entities.find((entity) => entity.id === draft.node.locationId)?.name ?? "No location";
    const nodeExists = context.snapshot.nodes.some((node) => node.id === draft.node.id);
    const invalidInput = context.snapshot.interactions.find((interaction) =>
      interaction.sourceNodeId === draft.node.id && interaction.matchMode === "fallback");
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
          summary: `${speaker} · ${location}${draft.node.tags.length ? ` · ${draft.node.tags.length} tag${draft.node.tags.length === 1 ? "" : "s"}` : ""}`,
          children: [{
            type: "custom",
            id: "node-context-fields",
            role: "resource-picker",
            content: <div className="node-focused-form">
              <label>CHARACTER / SPEAKER <ReferenceField kind="character" value={draft.node.characterId ?? ""} onChange={(characterId) => setDraft((current) => ({ ...current, node: { ...current.node, characterId: characterId || null } }))} placeholder="none / narration" /></label>
              <label>LOCATION <ReferenceField kind="location" value={draft.node.locationId ?? ""} onChange={(locationId) => setDraft((current) => ({ ...current, node: { ...current.node, locationId: locationId || null } }))} placeholder="none" /></label>
              <label>TAGS <input value={draft.node.tags.join(", ")} onChange={(event) => setDraft((current) => ({ ...current, node: { ...current.node, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } }))} /></label>
            </div>,
          }],
        },
        {
          type: "section",
          id: "node-input-handling",
          label: "INPUT HANDLING",
          summary: invalidInput ? "Invalid input response configured" : "No invalid input response",
          children: nodeExists ? [{
            type: "custom",
            id: "node-invalid-input",
            role: "results",
            content: <button
              type="button"
              className="node-invalid-input-link"
              onClick={() => context.pushTask(invalidInputRoute(draft.node.id, invalidInput?.id))}
            >
              <span>
                <strong>{invalidInput ? "INVALID INPUT RESPONSE" : "+ INVALID INPUT RESPONSE"}</strong>
                <small>Only for Node #{draft.node.nodeNumber}: what happens when player text matches nothing here.</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>,
          }] : [{
            type: "status",
            id: "node-invalid-input-save-first",
            tone: "info",
            text: "Save this Node before configuring its node-specific invalid input response.",
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
  async save({ draft, context, route }) {
    const data = routeData(route);
    const result = await context.persist(
      [{ type: "node.upsert", node: draft.node }],
      `${data?.nodeId ? "Changed" : "Created"} node #${draft.node.nodeNumber}`,
    );
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return {
      accepted: true,
      draft,
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
