import type { AuthorFeatureManifest } from "../../../author/features/types";
import { VALUES_COMMAND_REFERENCE_SOURCES } from "../commandReferences";
import { VALUES_WORKSPACES } from "./workspaces";
import { valuesAuthorSearch, valuesAuthorTools } from "./tools";
import { valuesProjectReferences } from "./references";
import { clearFlagEffectAdapter, decrementEffectAdapter, flagConditionAdapter, incrementEffectAdapter, setFlagEffectAdapter, setValueEffectAdapter, variableConditionAdapter } from "./ruleAdapters";

function resourceRoute(workspace: "value" | "derived-value", resourceKind: string, id?: string) {
  return { type: "feature" as const, feature: "values", workspace, data: { resourceKind, ...(id ? { resourceId: id } : {}) } };
}

export const valuesAuthorFeature: AuthorFeatureManifest = {
  id: "values",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "values") return null;
    if (route.workspace === "library") return "Values";
    const id = route.data?.resourceId;
    const definition = snapshot.valueDefinitions.find((item) => item.id === id) ?? snapshot.derivedValueDefinitions.find((item) => item.id === id);
    return definition?.label || definition?.key || (route.workspace === "derived-value" ? "New derived value" : "New value");
  },
  commandReferences: VALUES_COMMAND_REFERENCE_SOURCES,
  commandTargets: [
    {
      sourceKind: "values.value", label: "value",
      list: (snapshot, operation) => snapshot.valueDefinitions.map((definition) => ({ id: definition.id, label: definition.label || definition.key, available: definition.operations.includes(operation), responseCount: definition.hooks.filter((hook) => hook.operation === operation).length })),
      editRoute: (id, operation) => ({ type: "feature", feature: "values", workspace: "value", data: { resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "values", workspace: "value", data: { preferredOperation: operation } }),
    },
    {
      sourceKind: "values.derived", label: "derived value",
      list: (snapshot, operation) => snapshot.derivedValueDefinitions.map((definition) => ({ id: definition.id, label: definition.label || definition.key, available: definition.operations.includes(operation), responseCount: definition.hooks.filter((hook) => hook.operation === operation).length })),
      editRoute: (id, operation) => ({ type: "feature", feature: "values", workspace: "derived-value", data: { resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "values", workspace: "derived-value", data: { preferredOperation: operation } }),
    },
  ],
  conditions: [flagConditionAdapter, variableConditionAdapter],
  effects: [setFlagEffectAdapter, clearFlagEffectAdapter, setValueEffectAdapter, incrementEffectAdapter, decrementEffectAdapter],
  references: [valuesProjectReferences],
  tools: valuesAuthorTools,
  search: valuesAuthorSearch,
  workspaces: VALUES_WORKSPACES,
  resources: [
    { kind: "value", label: "Value", pluralLabel: "Values", list: (snapshot) => snapshot.valueDefinitions.map((item) => ({ id: item.id, value: item.key, label: item.label || item.key, detail: item.valueType })), createRoute: () => resourceRoute("value", "value"), editRoute: (resource) => resourceRoute("value", "value", resource.id) },
    { kind: "number-value", label: "Number Value", pluralLabel: "Number Values", searchable: false, list: (snapshot) => snapshot.valueDefinitions.filter((item) => item.valueType === "number").map((item) => ({ id: item.id, value: item.key, label: item.label || item.key })), createRoute: () => resourceRoute("value", "number-value"), editRoute: (resource) => resourceRoute("value", "number-value", resource.id) },
    { kind: "flag", label: "Flag", pluralLabel: "Flags", searchable: false, list: (snapshot) => snapshot.valueDefinitions.filter((item) => item.valueType === "boolean").map((item) => ({ id: item.id, value: item.key, label: item.label || item.key })), createRoute: () => resourceRoute("value", "flag"), editRoute: (resource) => resourceRoute("value", "flag", resource.id) },
    { kind: "value-definition", label: "Value", pluralLabel: "Values", searchable: false, list: (snapshot) => snapshot.valueDefinitions.map((item) => ({ id: item.id, value: item.id, label: item.label || item.key, detail: item.key })), createRoute: () => resourceRoute("value", "value-definition"), editRoute: (resource) => resourceRoute("value", "value-definition", resource.id) },
    { kind: "derived-value", label: "Derived Value", pluralLabel: "Derived Values", list: (snapshot) => snapshot.derivedValueDefinitions.map((item) => ({ id: item.id, value: item.key, label: item.label || item.key, detail: `${item.source.provider}:${item.source.metric}` })), createRoute: () => resourceRoute("derived-value", "derived-value"), editRoute: (resource) => resourceRoute("derived-value", "derived-value", resource.id) },
    { kind: "derived-definition", label: "Derived Value", pluralLabel: "Derived Values", searchable: false, list: (snapshot) => snapshot.derivedValueDefinitions.map((item) => ({ id: item.id, value: item.id, label: item.label || item.key, detail: item.key })), createRoute: () => resourceRoute("derived-value", "derived-definition"), editRoute: (resource) => resourceRoute("derived-value", "derived-definition", resource.id) },
  ],
  terminalShortcuts: [{ commands: ["/values", "values"], route: { type: "feature", feature: "values", workspace: "library" } }],
};
