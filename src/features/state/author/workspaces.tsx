import { ConditionEditor } from "../../../author/ConditionEditor";
import { resolveAuthorKey } from "../../../author/generatedKey";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { AuthorUiNode } from "../../../author/ui/types";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { Condition } from "../../../engine/rules/model";
import type {
  ComputedDefinition,
  StateGroupDefinition,
  StatePlayerPresentation,
  VariableDefinition,
} from "../model";
import { StateStatus } from "../ui/StateStatus";
import "./stateWorkspaces.css";

const ALWAYS: Condition = { type: "always" };
const WHEN_TEMPLATE: Condition = { type: "flag", key: "", value: true };

export type StateAuthorResourceKind = "variable" | "number-variable" | "flag" | "computed" | "state-group";

function stateRoute(kind?: StateAuthorResourceKind, id?: string, preferredOperation?: string) {
  return {
    type: "feature" as const,
    feature: "state",
    workspace: "definitions",
    data: {
      ...(kind ? { resourceKind: kind, resourceTask: kind } : {}),
      ...(id ? { resourceId: id } : {}),
      ...(preferredOperation ? { preferredOperation } : {}),
    },
  };
}

function visibilityChoice(
  id: string,
  label: string,
  condition: Condition,
  snapshot: ProjectSnapshot,
  setCondition: (condition: Condition) => void,
): AuthorUiNode {
  const conditional = condition.type !== "always";
  return {
    type: "choice",
    id: `${id}-visibility`,
    label,
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

function presentationNodes(
  id: string,
  presentation: StatePlayerPresentation | null | undefined,
  snapshot: ProjectSnapshot,
  setPresentation: (presentation: StatePlayerPresentation | null) => void,
): AuthorUiNode[] {
  const visible = Boolean(presentation);
  return [{
    type: "choice",
    id: `${id}-player-presentation`,
    label: "Player presentation",
    value: visible ? "group" : "hidden",
    presentation: "segmented",
    onChange: (choice) => setPresentation(choice === "hidden" ? null : {
      groupId: presentation?.groupId ?? snapshot.stateGroups[0]?.id ?? "",
      order: presentation?.order ?? 0,
      visibleWhen: presentation?.visibleWhen ?? ALWAYS,
    }),
    options: [
      { value: "hidden", label: "INTERNAL ONLY", help: "The value still drives rules but is not shown to the player." },
      {
        value: "group",
        label: "SHOW IN GROUP",
        content: visible ? [
          {
            type: "custom",
            id: `${id}-group-picker`,
            role: "resource-picker",
            content: <ReferenceField
              kind="state-group"
              value={presentation?.groupId ?? ""}
              allowEmpty={false}
              placeholder="choose or create a group"
              onChange={(groupId) => setPresentation({
                groupId,
                order: presentation?.order ?? 0,
                visibleWhen: presentation?.visibleWhen ?? ALWAYS,
              })}
            />,
          },
          {
            type: "field",
            id: `${id}-order`,
            label: "Order in group",
            control: "number",
            value: presentation?.order ?? 0,
            onChange: (value) => setPresentation({
              groupId: presentation?.groupId ?? "",
              order: Number(value),
              visibleWhen: presentation?.visibleWhen ?? ALWAYS,
            }),
          },
          visibilityChoice(
            `${id}-entry`,
            "Visible to player",
            presentation?.visibleWhen ?? ALWAYS,
            snapshot,
            (visibleWhen) => setPresentation({
              groupId: presentation?.groupId ?? "",
              order: presentation?.order ?? 0,
              visibleWhen,
            }),
          ),
        ] : [],
      },
    ],
  }];
}

function newVariable(kind?: StateAuthorResourceKind): VariableDefinition {
  const valueType: VariableDefinition["valueType"] = kind === "flag" ? "boolean" : "number";
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    valueType,
    initialValue: valueType === "boolean" ? false : 0,
    playerPresentation: null,
    interactable: false,
    operations: [],
    hooks: [],
    timeRate: 0,
    timeUnit: "second",
  };
}

function initialValueNode(draft: VariableDefinition, setDraft: (update: (current: VariableDefinition) => VariableDefinition) => void): AuthorUiNode {
  if (draft.valueType === "boolean") return {
    type: "choice",
    id: "state-variable-initial-boolean",
    label: "Starts",
    value: String(Boolean(draft.initialValue)),
    presentation: "segmented",
    onChange: (value) => setDraft((current) => ({ ...current, initialValue: value === "true" })),
    options: [{ value: "false", label: "FALSE" }, { value: "true", label: "TRUE" }],
  };
  return {
    type: "field",
    id: "state-variable-initial",
    label: "Starts at",
    control: draft.valueType === "number" ? "number" : "text",
    value: draft.initialValue === null ? "" : String(draft.initialValue),
    onChange: (value) => setDraft((current) => ({
      ...current,
      initialValue: current.valueType === "number" ? Number(value) : value,
    })),
  };
}

export const stateLibraryWorkspace = defineAuthorWorkspace({
  id: "state-library",
  matches: (route) => route.type === "feature" && route.feature === "state" && route.workspace === "definitions" && !route.data?.resourceKind,
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "state-library",
    title: "State",
    context: `${context.snapshot.variables.length} variables · ${context.snapshot.computedValues.length} computed · ${context.snapshot.stateGroups.length} player groups`,
    blocks: [
      {
        type: "section",
        id: "state-library-values",
        label: "Values",
        importance: "primary",
        children: [{
          type: "custom",
          id: "state-value-list",
          role: "results",
          content: <div className="state-author-resource-list">
            <div className="state-author-create-row">
              <button type="button" onClick={() => context.pushTask(stateRoute("variable"))}>[+ VARIABLE]</button>
              <button type="button" onClick={() => context.pushTask(stateRoute("flag"))}>[+ FLAG]</button>
              <button type="button" onClick={() => context.pushTask(stateRoute("computed"))}>[+ COMPUTED]</button>
            </div>
            {context.snapshot.variables.map((definition) => <button type="button" key={definition.id} onClick={() => context.pushTask(stateRoute("variable", definition.id))}>
              <span>{definition.label || definition.key}</span><small>{definition.valueType}{definition.playerPresentation ? " · player" : " · internal"}</small>
            </button>)}
            {context.snapshot.computedValues.map((definition) => <button type="button" key={definition.id} onClick={() => context.pushTask(stateRoute("computed", definition.id))}>
              <span>{definition.label || definition.key}</span><small>computed{definition.playerPresentation ? " · player" : " · internal"}</small>
            </button>)}
          </div>,
        }],
      },
      {
        type: "section",
        id: "state-library-groups",
        label: "Player groups",
        children: [{
          type: "custom",
          id: "state-group-list",
          role: "ordered-list",
          content: <div className="state-author-resource-list">
            <div className="state-author-create-row">
              <button type="button" onClick={() => context.pushTask(stateRoute("state-group"))}>[+ GROUP]</button>
              <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "state", workspace: "status" })}>[PREVIEW]</button>
            </div>
            {[...context.snapshot.stateGroups].sort((a, b) => a.order - b.order).map((group) => {
              const count = [...context.snapshot.variables, ...context.snapshot.computedValues]
                .filter((definition) => definition.playerPresentation?.groupId === group.id).length;
              return <button type="button" key={group.id} onClick={() => context.pushTask(stateRoute("state-group", group.id))}>
                <span>{group.label}</span><small>{count} value{count === 1 ? "" : "s"}</small>
              </button>;
            })}
            {!context.snapshot.stateGroups.length ? <small className="state-author-empty">No player groups yet. Internal variables remain completely hidden.</small> : null}
          </div>,
        }],
      },
    ],
  }),
});

export const stateVariableWorkspace = defineAuthorWorkspace<VariableDefinition>({
  id: "state-variable",
  matches: (route) => route.type === "feature" && route.feature === "state" && route.workspace === "definitions" && ["variable", "number-variable", "flag"].includes(route.data?.resourceKind ?? ""),
  createDraft: (route, context) => structuredClone(context.snapshot.variables.find((candidate) => candidate.id === route.data?.resourceId) ?? newVariable(route.data?.resourceKind as StateAuthorResourceKind | undefined)),
  buildSpec: ({ route, context, draft, setDraft }) => {
    const existing = context.snapshot.variables.some((candidate) => candidate.id === draft.id);
    const lockedType = route.data?.resourceKind === "flag" ? "boolean" : route.data?.resourceKind === "number-variable" ? "number" : null;
    return {
      id: "state-variable",
      title: draft.label || "New variable",
      context: draft.playerPresentation ? "Player-visible State value" : "Internal State value",
      blocks: [
        {
          type: "section",
          id: "state-variable-value",
          label: "Value",
          importance: "primary",
          children: [
            { type: "field", id: "state-variable-label", label: "Name", value: draft.label, autoFocus: !existing, onChange: (label) => setDraft((current) => ({ ...current, label })) },
            { type: "field", id: "state-variable-key", label: "Key", value: draft.key, placeholder: "generated from name", help: "Stable rule/text key.", onChange: (key) => setDraft((current) => ({ ...current, key })) },
            ...(lockedType ? [] : [{
              type: "choice" as const,
              id: "state-variable-type",
              label: "Type",
              value: draft.valueType,
              presentation: "segmented" as const,
              onChange: (valueType: string) => setDraft((current) => ({
                ...current,
                valueType: valueType as VariableDefinition["valueType"],
                initialValue: valueType === "boolean" ? false : valueType === "number" ? 0 : "",
              })),
              options: [{ value: "number", label: "NUMBER" }, { value: "boolean", label: "TRUE / FALSE" }, { value: "string", label: "TEXT" }],
            }]),
            initialValueNode(draft, setDraft),
          ],
        },
        ...(draft.valueType === "number" ? [{
          type: "disclosure" as const,
          id: "state-variable-time",
          label: "Change over time",
          summary: Number(draft.timeRate ?? 0) ? `${draft.timeRate} per ${draft.timeUnit}` : "Off",
          children: [
            { type: "field" as const, id: "state-variable-time-rate", label: "Change", control: "number" as const, value: draft.timeRate ?? 0, help: "Use a negative number to decrease.", onChange: (value: string) => setDraft((current) => ({ ...current, timeRate: Number(value) })) },
            { type: "choice" as const, id: "state-variable-time-unit", label: "Per", value: draft.timeUnit ?? "second", presentation: "segmented" as const, onChange: (timeUnit: string) => setDraft((current) => ({ ...current, timeUnit: timeUnit as VariableDefinition["timeUnit"] })), options: [{ value: "second", label: "SECOND" }, { value: "minute", label: "MINUTE" }, { value: "hour", label: "HOUR" }] },
          ],
        }] : []),
        {
          type: "disclosure",
          id: "state-variable-player",
          label: "Player presentation",
          summary: draft.playerPresentation
            ? context.snapshot.stateGroups.find((group) => group.id === draft.playerPresentation?.groupId)?.label || "Choose a group"
            : "Internal only",
          defaultOpen: Boolean(draft.playerPresentation),
          children: presentationNodes("state-variable", draft.playerPresentation, context.snapshot, (playerPresentation) => setDraft((current) => ({ ...current, playerPresentation }))),
        },
        {
          type: "disclosure",
          id: "state-variable-behavior",
          label: "Player interactions",
          summary: draft.interactable ? `${draft.operations.length} operations` : "Not directly interactable",
          defaultOpen: Boolean(route.data?.preferredOperation),
          children: [{
            type: "custom",
            id: "state-variable-operations",
            role: "specialized-control",
            content: <OperationHooksEditor
              capability={{ interactable: draft.interactable, operations: draft.operations, hooks: draft.hooks }}
              snapshot={context.snapshot}
              targetKind="state.variable"
              defaultOpen={Boolean(route.data?.preferredOperation)}
              preferredOperation={route.data?.preferredOperation}
              onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))}
            />,
          }],
        },
      ],
    };
  },
  async save({ route, context, draft }) {
    if (!draft.label.trim()) return { accepted: false };
    if (draft.playerPresentation && !context.snapshot.stateGroups.some((group) => group.id === draft.playerPresentation?.groupId)) return { accepted: false };
    const key = resolveAuthorKey({
      override: draft.key,
      source: draft.label,
      existingKeys: context.snapshot.variables.filter((definition) => definition.id !== draft.id).map((definition) => definition.key),
      fallback: "variable",
    });
    const lockedType = route.data?.resourceKind === "flag" ? "boolean" : route.data?.resourceKind === "number-variable" ? "number" : null;
    const saved = { ...draft, key, valueType: lockedType ?? draft.valueType };
    const result = await context.persist([{ type: "variable.upsert", definition: saved }], `Save variable ${saved.label || key}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    const resourceKind = route.data?.resourceTask;
    return {
      accepted: true,
      draft: saved,
      ...(resourceKind ? { completion: { type: "resource" as const, kind: resourceKind, id: saved.id, value: saved.key, label: saved.label || saved.key } } : {}),
    };
  },
});

function newComputed(): ComputedDefinition {
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    source: "elapsed_seconds",
    format: "integer",
    playerPresentation: null,
    interactable: false,
    operations: [],
    hooks: [],
  };
}

export const stateComputedWorkspace = defineAuthorWorkspace<ComputedDefinition>({
  id: "state-computed",
  matches: (route) => route.type === "feature" && route.feature === "state" && route.workspace === "definitions" && route.data?.resourceKind === "computed",
  createDraft: (route, context) => structuredClone(context.snapshot.computedValues.find((candidate) => candidate.id === route.data?.resourceId) ?? newComputed()),
  buildSpec: ({ route, context, draft, setDraft }) => ({
    id: "state-computed",
    title: draft.label || "New computed value",
    context: draft.playerPresentation ? "Player-visible derived State" : "Internal derived State",
    blocks: [
      {
        type: "section",
        id: "state-computed-value",
        label: "Computed value",
        importance: "primary",
        children: [
          { type: "field", id: "state-computed-label", label: "Name", value: draft.label, autoFocus: !context.snapshot.computedValues.some((candidate) => candidate.id === draft.id), onChange: (label) => setDraft((current) => ({ ...current, label })) },
          { type: "field", id: "state-computed-key", label: "Key", value: draft.key, placeholder: "generated from name", onChange: (key) => setDraft((current) => ({ ...current, key })) },
          { type: "choice", id: "state-computed-source", label: "Source", value: draft.source, onChange: (source) => setDraft((current) => ({ ...current, source: source as ComputedDefinition["source"] })), options: [
            { value: "elapsed_seconds", label: "ELAPSED TIME" },
            { value: "commands_entered", label: "COMMANDS ENTERED" },
            { value: "inventory_slots_used", label: "INVENTORY SLOTS USED" },
            { value: "visited_nodes", label: "VISITED NODES" },
          ] },
          { type: "choice", id: "state-computed-format", label: "Display format", value: draft.format, presentation: "segmented", onChange: (format) => setDraft((current) => ({ ...current, format: format as ComputedDefinition["format"] })), options: [{ value: "raw", label: "RAW" }, { value: "integer", label: "INTEGER" }, { value: "seconds", label: "SECONDS" }] },
        ],
      },
      {
        type: "disclosure",
        id: "state-computed-player",
        label: "Player presentation",
        summary: draft.playerPresentation
          ? context.snapshot.stateGroups.find((group) => group.id === draft.playerPresentation?.groupId)?.label || "Choose a group"
          : "Internal only",
        defaultOpen: Boolean(draft.playerPresentation),
        children: presentationNodes("state-computed", draft.playerPresentation, context.snapshot, (playerPresentation) => setDraft((current) => ({ ...current, playerPresentation }))),
      },
      {
        type: "disclosure",
        id: "state-computed-behavior",
        label: "Player interactions",
        summary: draft.interactable ? `${draft.operations.length} operations` : "Not directly interactable",
        defaultOpen: Boolean(route.data?.preferredOperation),
        children: [{
          type: "custom",
          id: "state-computed-operations",
          role: "specialized-control",
          content: <OperationHooksEditor
            capability={{ interactable: draft.interactable, operations: draft.operations, hooks: draft.hooks }}
            snapshot={context.snapshot}
            targetKind="state.computed"
            defaultOpen={Boolean(route.data?.preferredOperation)}
            preferredOperation={route.data?.preferredOperation}
            onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))}
          />,
        }],
      },
    ],
  }),
  async save({ route, context, draft }) {
    if (!draft.label.trim()) return { accepted: false };
    if (draft.playerPresentation && !context.snapshot.stateGroups.some((group) => group.id === draft.playerPresentation?.groupId)) return { accepted: false };
    const key = resolveAuthorKey({ override: draft.key, source: draft.label, existingKeys: context.snapshot.computedValues.filter((definition) => definition.id !== draft.id).map((definition) => definition.key), fallback: "computed" });
    const saved = { ...draft, key };
    const result = await context.persist([{ type: "computed.upsert", definition: saved }], `Save computed value ${saved.label || key}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return {
      accepted: true,
      draft: saved,
      ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: "computed", id: saved.id, value: saved.key, label: saved.label || saved.key } } : {}),
    };
  },
});

function newGroup(snapshot: ProjectSnapshot): StateGroupDefinition {
  return {
    id: crypto.randomUUID(),
    label: "",
    order: Math.max(-1, ...snapshot.stateGroups.map((group) => group.order)) + 1,
    visibleWhen: ALWAYS,
  };
}

export const stateGroupWorkspace = defineAuthorWorkspace<StateGroupDefinition>({
  id: "state-group",
  matches: (route) => route.type === "feature" && route.feature === "state" && route.workspace === "definitions" && route.data?.resourceKind === "state-group",
  createDraft: (route, context) => structuredClone(context.snapshot.stateGroups.find((candidate) => candidate.id === route.data?.resourceId) ?? newGroup(context.snapshot)),
  buildSpec: ({ route, context, draft, setDraft }) => {
    const existing = context.snapshot.stateGroups.some((candidate) => candidate.id === draft.id);
    const memberCount = [...context.snapshot.variables, ...context.snapshot.computedValues]
      .filter((definition) => definition.playerPresentation?.groupId === draft.id).length;
    return {
      id: "state-group",
      title: draft.label || "New player group",
      context: `${memberCount} value${memberCount === 1 ? "" : "s"}`,
      blocks: [{
        type: "section",
        id: "state-group-details",
        label: "Player group",
        importance: "primary",
        children: [
          { type: "field", id: "state-group-label", label: "Name", value: draft.label, autoFocus: !existing, placeholder: "Attributes, Relationships, Reputation…", onChange: (label) => setDraft((current) => ({ ...current, label })) },
          { type: "field", id: "state-group-order", label: "Group order", control: "number", value: draft.order, onChange: (order) => setDraft((current) => ({ ...current, order: Number(order) })) },
          visibilityChoice("state-group", "Group visible", draft.visibleWhen, context.snapshot, (visibleWhen) => setDraft((current) => ({ ...current, visibleWhen }))),
        ],
      }],
      actions: existing ? [{
        id: "state-group-delete",
        label: `DELETE${memberCount ? ` · HIDES ${memberCount}` : ""}`,
        tone: "danger",
        onAction: () => {
          if (!window.confirm(`Delete player group “${draft.label}”? Values in it will become internal-only.`)) return;
          void context.persist([{ type: "stateGroup.delete", id: draft.id }], `Delete State group ${draft.label}`).then((result) => {
            if ((result.status === "saved" || result.status === "queued") && context.hasParentTask) context.leaveCurrentTask();
          });
        },
      }] : [],
    };
  },
  async save({ route, context, draft }) {
    if (!draft.label.trim()) return { accepted: false };
    const saved = { ...draft, label: draft.label.trim() };
    const result = await context.persist([{ type: "stateGroup.upsert", group: saved }], `Save State group ${saved.label}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return {
      accepted: true,
      draft: saved,
      ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: "state-group", id: saved.id, value: saved.id, label: saved.label } } : {}),
    };
  },
});

export const statePlayerWorkspace = defineAuthorWorkspace({
  id: "state-player-status",
  matches: (route) => route.type === "feature" && route.feature === "state" && route.workspace === "status",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "state-player-status",
    title: "Status",
    context: "Player-visible State",
    blocks: [{
      type: "custom",
      id: "state-player-status-surface",
      role: "specialized-control",
      content: <StateStatus
        snapshot={context.snapshot}
        state={context.playState}
        onState={context.runtime.updateState}
        onOutput={context.runtime.output}
        onEvents={context.runtime.events}
      />,
    }],
  }),
});

export const STATE_WORKSPACES = [
  stateLibraryWorkspace,
  stateVariableWorkspace,
  stateComputedWorkspace,
  stateGroupWorkspace,
  statePlayerWorkspace,
] as const;
