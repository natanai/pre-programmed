import type { AuthorFeatureManifest } from "../../../author/features/types";
import { STATE_COMMAND_REFERENCE_SOURCES } from "../commandReferences";
import {
  clearFlagEffectAdapter,
  decrementEffectAdapter,
  flagConditionAdapter,
  incrementEffectAdapter,
  setFlagEffectAdapter,
  setValueEffectAdapter,
  variableConditionAdapter,
} from "./ruleAdapters";
import { stateProjectReferences } from "./references";
import { stateAuthorSearch, stateAuthorTools } from "./tools";
import { stateStatusAuthorWorkspace } from "./statusWorkspace";
import { STATE_WORKSPACES, type StateAuthorResourceKind } from "./workspaces";

const DEFINITIONS_ROUTE = { type: "feature", feature: "state", workspace: "definitions" } as const;

function stateResourceRoute(kind: StateAuthorResourceKind, id?: string, preferredOperation?: string) {
  return {
    type: "feature" as const,
    feature: "state",
    workspace: "definitions",
    data: {
      resourceKind: kind,
      resourceTask: kind,
      ...(id ? { resourceId: id } : {}),
      ...(preferredOperation ? { preferredOperation } : {}),
    },
  };
}

export const stateAuthorFeature: AuthorFeatureManifest = {
  id: "state",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "state") return null;
    if (route.workspace === "status") return "Player status";
    if (route.workspace !== "definitions") return null;
    const id = route.data?.resourceId;
    const variable = snapshot.variables.find((candidate) => candidate.id === id);
    const computed = snapshot.computedValues.find((candidate) => candidate.id === id);
    const group = snapshot.stateGroups.find((candidate) => candidate.id === id);
    if (variable) return variable.label || variable.key;
    if (computed) return computed.label || computed.key;
    if (group) return group.label;
    const kind = route.data?.resourceKind;
    return kind ? `New ${kind.replaceAll("-", " ")}` : "State";
  },
  commandReferences: STATE_COMMAND_REFERENCE_SOURCES,
  commandTargets: [
    {
      sourceKind: "state.variable",
      label: "variable",
      list: (snapshot, operation) => snapshot.variables.map((definition) => ({
        id: definition.id,
        label: definition.label || definition.key || "Untitled variable",
        available: definition.operations.includes(operation),
        responseCount: definition.hooks.filter((hook) => hook.operation === operation).length,
      })),
      editRoute: (id, operation) => stateResourceRoute("variable", id, operation),
      createRoute: (operation) => stateResourceRoute("variable", undefined, operation),
    },
    {
      sourceKind: "state.computed",
      label: "computed value",
      list: (snapshot, operation) => snapshot.computedValues.map((definition) => ({
        id: definition.id,
        label: definition.label || definition.key || "Untitled computed value",
        available: definition.operations.includes(operation),
        responseCount: definition.hooks.filter((hook) => hook.operation === operation).length,
      })),
      editRoute: (id, operation) => stateResourceRoute("computed", id, operation),
      createRoute: (operation) => stateResourceRoute("computed", undefined, operation),
    },
  ],
  conditions: [flagConditionAdapter, variableConditionAdapter],
  effects: [setFlagEffectAdapter, clearFlagEffectAdapter, setValueEffectAdapter, incrementEffectAdapter, decrementEffectAdapter],
  references: [stateProjectReferences],
  tools: stateAuthorTools,
  search: stateAuthorSearch,
  workspaces: [stateStatusAuthorWorkspace, ...STATE_WORKSPACES],
  resources: [
    {
      kind: "variable",
      label: "Variable",
      pluralLabel: "Variables",
      list: (snapshot) => snapshot.variables.map((item) => ({ id: item.id, value: item.key, label: item.label || item.key, detail: item.valueType })),
      listRoute: () => DEFINITIONS_ROUTE,
      createRoute: () => stateResourceRoute("variable"),
      editRoute: (resource) => stateResourceRoute("variable", resource.id),
    },
    {
      kind: "number-variable",
      label: "Number Variable",
      pluralLabel: "Number Variables",
      searchable: false,
      list: (snapshot) => snapshot.variables.filter((item) => item.valueType === "number").map((item) => ({ id: item.id, value: item.key, label: item.label || item.key })),
      listRoute: () => DEFINITIONS_ROUTE,
      createRoute: () => stateResourceRoute("number-variable"),
      editRoute: (resource) => stateResourceRoute("number-variable", resource.id),
    },
    {
      kind: "flag",
      label: "Flag",
      pluralLabel: "Flags",
      searchable: false,
      list: (snapshot) => snapshot.variables.filter((item) => item.valueType === "boolean").map((item) => ({ id: item.id, value: item.key, label: item.label || item.key })),
      listRoute: () => DEFINITIONS_ROUTE,
      createRoute: () => stateResourceRoute("flag"),
      editRoute: (resource) => stateResourceRoute("flag", resource.id),
    },
    {
      kind: "computed",
      label: "Computed Value",
      pluralLabel: "Computed Values",
      list: (snapshot) => snapshot.computedValues.map((item) => ({ id: item.id, value: item.key, label: item.label || item.key, detail: item.source })),
      listRoute: () => DEFINITIONS_ROUTE,
      createRoute: () => stateResourceRoute("computed"),
      editRoute: (resource) => stateResourceRoute("computed", resource.id),
    },
    {
      kind: "state-group",
      label: "Player Group",
      pluralLabel: "Player Groups",
      list: (snapshot) => snapshot.stateGroups.map((group) => ({ id: group.id, value: group.id, label: group.label, detail: "State presentation" })),
      listRoute: () => DEFINITIONS_ROUTE,
      createRoute: () => stateResourceRoute("state-group"),
      editRoute: (resource) => stateResourceRoute("state-group", resource.id),
    },
  ],
  terminalShortcuts: [
    { commands: ["/definitions", "definitions", "/state"], route: DEFINITIONS_ROUTE },
  ],
};
