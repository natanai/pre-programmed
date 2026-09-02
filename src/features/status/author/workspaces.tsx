import { ConditionEditor } from "../../../author/ConditionEditor";
import { resolveAuthorKey } from "../../../author/generatedKey";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { AuthorUiNode } from "../../../author/ui/types";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { Condition } from "../../../engine/rules/model";
import type { StatusEntryDefinition, StatusGroupDefinition } from "../model";
import { Status } from "../ui/Status";

const ALWAYS: Condition = { type: "always" };
const WHEN_TEMPLATE: Condition = { type: "flag", key: "", value: true };

function visibilityChoice(
  id: string,
  condition: Condition,
  snapshot: ProjectSnapshot,
  setCondition: (condition: Condition) => void,
): AuthorUiNode {
  const conditional = condition.type !== "always";
  return {
    type: "choice",
    id: `${id}-visibility`,
    label: "Visible",
    value: conditional ? "when" : "always",
    presentation: "segmented",
    onChange: (choice) => setCondition(choice === "always" ? ALWAYS : WHEN_TEMPLATE),
    options: [
      { value: "always", label: "ALWAYS" },
      {
        value: "when",
        label: "WHEN...",
        content: conditional ? [{
          type: "custom",
          id: `${id}-condition`,
          role: "rule-editor",
          content: <ConditionEditor condition={condition} snapshot={snapshot} onChange={setCondition} />,
        }] : [],
      },
    ],
  };
}

export const statusPlayerWorkspace = defineAuthorWorkspace({
  id: "status-player",
  matches: (route) => route.type === "feature" && route.feature === "status" && route.workspace === "status",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "status-player",
    title: "Status",
    context: "Player information",
    blocks: [{
      type: "custom",
      id: "status-player-view",
      role: "specialized-control",
      content: <Status snapshot={context.snapshot} state={context.playState} />,
    }],
  }),
});

export const statusLibraryWorkspace = defineAuthorWorkspace({
  id: "status-library",
  matches: (route) => route.type === "feature" && route.feature === "status" && route.workspace === "library",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "status-library",
    title: "Player status",
    context: "What players can see",
    blocks: [{
      type: "custom",
      id: "status-groups",
      role: "ordered-list",
      content: <div className="author-ui-resource-list">
        <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "status", workspace: "group" })}>[+ GROUP]</button>
        {[...context.snapshot.statusGroups].sort((a, b) => a.order - b.order).map((group) => {
          const count = context.snapshot.statusEntries.filter((entry) => entry.groupId === group.id).length;
          return <button type="button" key={group.id} onClick={() => context.pushTask({ type: "feature", feature: "status", workspace: "group", data: { groupId: group.id } })}>
            <span>{group.label || group.key}</span><small>{count} entr{count === 1 ? "y" : "ies"}</small>
          </button>;
        })}
        {!context.snapshot.statusGroups.length ? <small className="author-ui-resource-empty">Hidden game values stay hidden until you add them to a group here.</small> : null}
      </div>,
    }],
  }),
});

function newGroup(snapshot: ProjectSnapshot): StatusGroupDefinition {
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    order: Math.max(-1, ...snapshot.statusGroups.map((group) => group.order)) + 1,
    visibleWhen: ALWAYS,
  };
}

export const statusGroupWorkspace = defineAuthorWorkspace<StatusGroupDefinition>({
  id: "status-group",
  matches: (route) => route.type === "feature" && route.feature === "status" && route.workspace === "group",
  createDraft: (route, context) => structuredClone(context.snapshot.statusGroups.find((candidate) => candidate.id === route.data?.groupId) ?? newGroup(context.snapshot)),
  buildSpec: ({ context, draft, setDraft }) => {
    const persisted = context.snapshot.statusGroups.some((group) => group.id === draft.id);
    const entries = context.snapshot.statusEntries.filter((entry) => entry.groupId === draft.id).sort((a, b) => a.order - b.order);
    return {
      id: "status-group",
      title: draft.label || "New status group",
      context: "Player-visible collection",
      blocks: [
        {
          type: "section",
          id: "status-group-details",
          label: "Group",
          importance: "primary",
          children: [
            { type: "field", id: "status-group-label", label: "Name", value: draft.label, autoFocus: !persisted, placeholder: "Attributes, Relationships, Reputation…", onChange: (label) => setDraft((current) => ({ ...current, label })) },
            { type: "field", id: "status-group-key", label: "Key", value: draft.key, placeholder: "generated from name", onChange: (key) => setDraft((current) => ({ ...current, key })) },
            visibilityChoice("status-group", draft.visibleWhen, context.snapshot, (visibleWhen) => setDraft((current) => ({ ...current, visibleWhen }))),
          ],
        },
        {
          type: "custom",
          id: "status-group-entries",
          role: "ordered-list",
          content: <div className="author-ui-resource-list">
            {persisted
              ? <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "status", workspace: "entry", data: { groupId: draft.id } })}>[+ ENTRY]</button>
              : <small className="author-ui-resource-empty">Save this group before adding entries.</small>}
            {entries.map((entry) => <button type="button" key={entry.id} onClick={() => context.pushTask({ type: "feature", feature: "status", workspace: "entry", data: { groupId: draft.id, entryId: entry.id } })}>
              <span>{entry.label || "Status entry"}</span>
            </button>)}
          </div>,
        },
      ],
    };
  },
  async save({ context, draft }) {
    const key = resolveAuthorKey({
      override: draft.key,
      source: draft.label,
      existingKeys: context.snapshot.statusGroups.filter((group) => group.id !== draft.id).map((group) => group.key),
      fallback: "status",
    });
    const saved = { ...draft, key };
    const result = await context.persist([{ type: "statusGroup.upsert", group: saved }], `Save status group ${saved.label || key}`);
    return result.status === "saved" || result.status === "queued" ? { accepted: true, draft: saved } : { accepted: false };
  },
});

function newEntry(snapshot: ProjectSnapshot, groupId: string): StatusEntryDefinition {
  const source = snapshot.valueDefinitions[0]
    ? { kind: "value" as const, id: snapshot.valueDefinitions[0].id }
    : snapshot.derivedValueDefinitions[0]
      ? { kind: "derived" as const, id: snapshot.derivedValueDefinitions[0].id }
      : { kind: "value" as const, id: "" };
  return {
    id: crypto.randomUUID(),
    groupId,
    source,
    label: "",
    order: Math.max(-1, ...snapshot.statusEntries.filter((entry) => entry.groupId === groupId).map((entry) => entry.order)) + 1,
    visibleWhen: ALWAYS,
  };
}

export const statusEntryWorkspace = defineAuthorWorkspace<StatusEntryDefinition>({
  id: "status-entry",
  matches: (route) => route.type === "feature" && route.feature === "status" && route.workspace === "entry",
  createDraft: (route, context) => structuredClone(context.snapshot.statusEntries.find((candidate) => candidate.id === route.data?.entryId) ?? newEntry(context.snapshot, route.data?.groupId ?? "")),
  buildSpec: ({ context, draft, setDraft }) => ({
    id: "status-entry",
    title: draft.label || "Status entry",
    context: context.snapshot.statusGroups.find((group) => group.id === draft.groupId)?.label || "Status",
    blocks: [{
      type: "section",
      id: "status-entry-details",
      label: "Entry",
      importance: "primary",
      children: [
        {
          type: "choice",
          id: "status-entry-source-kind",
          label: "Show",
          value: draft.source.kind,
          presentation: "segmented",
          onChange: (kind) => setDraft((current) => ({ ...current, source: { kind: kind as "value" | "derived", id: "" } })),
          options: [
            {
              value: "value",
              label: "VALUE",
              content: draft.source.kind === "value" ? [{
                type: "custom",
                id: "status-entry-value",
                role: "resource-picker",
                content: <ReferenceField kind="value-definition" value={draft.source.id} allowEmpty={false} onChange={(id) => setDraft((current) => ({ ...current, source: { kind: "value", id } }))} />,
              }] : [],
            },
            {
              value: "derived",
              label: "DERIVED",
              content: draft.source.kind === "derived" ? [{
                type: "custom",
                id: "status-entry-derived",
                role: "resource-picker",
                content: <ReferenceField kind="derived-definition" value={draft.source.id} allowEmpty={false} onChange={(id) => setDraft((current) => ({ ...current, source: { kind: "derived", id } }))} />,
              }] : [],
            },
          ],
        },
        { type: "field", id: "status-entry-label", label: "Player label", value: draft.label, placeholder: "leave blank to use the value name", onChange: (label) => setDraft((current) => ({ ...current, label })) },
        visibilityChoice("status-entry", draft.visibleWhen, context.snapshot, (visibleWhen) => setDraft((current) => ({ ...current, visibleWhen }))),
      ],
    }],
  }),
  async save({ context, draft }) {
    if (!draft.groupId || !draft.source.id) return { accepted: false };
    const result = await context.persist([{ type: "statusEntry.upsert", entry: draft }], `Save status entry ${draft.label || draft.id}`);
    return result.status === "saved" || result.status === "queued" ? { accepted: true } : { accepted: false };
  },
});

export const STATUS_WORKSPACES = [
  statusPlayerWorkspace,
  statusLibraryWorkspace,
  statusGroupWorkspace,
  statusEntryWorkspace,
] as const;
