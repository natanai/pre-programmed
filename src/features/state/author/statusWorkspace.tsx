import { evaluateCondition } from "../../../engine/rules/conditions";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import { readComputedValue } from "../runtimeValues";
import type { ComputedDefinition, VariableDefinition } from "../model";
import "./stateWorkspaces.css";

function stateResourceRoute(kind: "variable" | "computed" | "state-group", id?: string) {
  return {
    type: "feature" as const,
    feature: "state",
    workspace: "definitions",
    data: {
      resourceKind: kind,
      resourceTask: kind,
      ...(id ? { resourceId: id } : {}),
    },
  };
}

function displayValue(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return value === null || value === undefined ? "—" : String(value);
}

function entryValue(definition: VariableDefinition | ComputedDefinition, context: Parameters<typeof readComputedValue>[1] extends never ? never : never) {
  return context;
}

export const stateStatusAuthorWorkspace = defineAuthorWorkspace({
  id: "state-status-author",
  matches: (route) => route.type === "feature" && route.feature === "state" && route.workspace === "status",
  createDraft: () => ({}),
  buildSpec: ({ context }) => {
    const now = Date.now();
    const groups = [...context.snapshot.stateGroups]
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
    const playerValues = [
      ...context.snapshot.variables.filter((definition) => definition.playerPresentation),
      ...context.snapshot.computedValues.filter((definition) => definition.playerPresentation),
    ];

    return {
      id: "state-status-author",
      title: "Player status",
      context: `${groups.length} group${groups.length === 1 ? "" : "s"} · ${playerValues.length} player value${playerValues.length === 1 ? "" : "s"}`,
      blocks: [{
        type: "section",
        id: "state-status-groups",
        label: "Player groups",
        importance: "primary",
        children: [{
          type: "custom",
          id: "state-status-group-list",
          role: "results",
          content: <div className="state-author-resource-list">
            <div className="state-author-create-row">
              <button type="button" onClick={() => context.pushTask(stateResourceRoute("state-group"))}>[+ GROUP]</button>
              <button type="button" onClick={() => context.pushTask(stateResourceRoute("variable"))}>[+ VALUE]</button>
            </div>
            {groups.map((group) => {
              const groupVisible = evaluateCondition(group.visibleWhen, { snapshot: context.snapshot, state: context.playState });
              const members = [
                ...context.snapshot.variables
                  .filter((definition) => definition.playerPresentation?.groupId === group.id)
                  .map((definition) => ({ kind: "variable" as const, definition })),
                ...context.snapshot.computedValues
                  .filter((definition) => definition.playerPresentation?.groupId === group.id)
                  .map((definition) => ({ kind: "computed" as const, definition })),
              ].sort((left, right) =>
                (left.definition.playerPresentation?.order ?? 0) - (right.definition.playerPresentation?.order ?? 0)
                || left.definition.label.localeCompare(right.definition.label));

              return <section className="state-author-status-group" key={group.id}>
                <button type="button" onClick={() => context.pushTask(stateResourceRoute("state-group", group.id))}>
                  <span>{group.label}</span>
                  <small>{groupVisible ? "visible now" : "hidden now"} · {members.length} value{members.length === 1 ? "" : "s"}</small>
                </button>
                {members.map(({ kind, definition }) => {
                  const presentation = definition.playerPresentation;
                  const entryVisible = groupVisible && Boolean(presentation && evaluateCondition(presentation.visibleWhen, { snapshot: context.snapshot, state: context.playState }));
                  const value = kind === "computed"
                    ? readComputedValue(definition, context.snapshot, context.playState, now)
                    : context.playState.values[definition.key] ?? definition.initialValue;
                  return <button type="button" key={`${kind}:${definition.id}`} onClick={() => context.pushTask(stateResourceRoute(kind, definition.id))}>
                    <span>↳ {definition.label || definition.key}</span>
                    <small>{displayValue(value)} · {entryVisible ? "visible now" : "hidden now"}</small>
                  </button>;
                })}
              </section>;
            })}
            {!groups.length ? <small className="state-author-empty">No player groups yet. Create a group, then assign State values to it.</small> : null}
          </div>,
        }],
      }],
    };
  },
});
