import type { AuthorFeatureManifest } from "../../../author/features/types";
import { DefinitionsPanel, type StateAuthorResourceKind } from "./DefinitionsPanel";
import { stateAuthorSearch, stateAuthorTools } from "./tools";
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

const DEFINITIONS_ROUTE = { type: "feature", feature: "state", workspace: "definitions" } as const;

function stateResourceRoute(kind: StateAuthorResourceKind, id?: string) {
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

export const stateAuthorFeature: AuthorFeatureManifest = {
  id: "state",
  describeTask(route, snapshot) {
    if (route.type !== "feature" || route.feature !== "state" || route.workspace !== "definitions") return null;
    const id = route.data?.resourceId;
    const variable = snapshot.variables.find((candidate) => candidate.id === id);
    const computed = snapshot.computedValues.find((candidate) => candidate.id === id);
    const entity = snapshot.entities.find((candidate) => candidate.id === id);
    if (variable) return variable.label || variable.key;
    if (computed) return computed.label || computed.key;
    if (entity) return entity.name || entity.key;
    const kind = route.data?.resourceKind;
    return kind ? `New ${kind.replaceAll("-", " ")}` : "State + people";
  },
  commandReferences: STATE_COMMAND_REFERENCE_SOURCES,
  commandTargets: [
    {
      sourceKind: "world.character",
      label: "character",
      list: (snapshot, operation) => snapshot.entities.filter((entity) => entity.type === "character").map((entity) => ({
        id: entity.id,
        label: entity.name || entity.key || "Untitled character",
        available: (entity.operations ?? []).includes(operation),
        responseCount: (entity.hooks ?? []).filter((hook) => hook.operation === operation).length,
      })),
      editRoute: (id, operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "character", resourceTask: "character", resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "character", resourceTask: "character", preferredOperation: operation } }),
    },
    {
      sourceKind: "world.location",
      label: "location",
      list: (snapshot, operation) => snapshot.entities.filter((entity) => entity.type === "location").map((entity) => ({
        id: entity.id,
        label: entity.name || entity.key || "Untitled location",
        available: (entity.operations ?? []).includes(operation),
        responseCount: (entity.hooks ?? []).filter((hook) => hook.operation === operation).length,
      })),
      editRoute: (id, operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "location", resourceTask: "location", resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "location", resourceTask: "location", preferredOperation: operation } }),
    },
    {
      sourceKind: "state.variable",
      label: "variable",
      list: (snapshot, operation) => snapshot.variables.map((definition) => ({
        id: definition.id,
        label: definition.label || definition.key || "Untitled variable",
        available: definition.operations.includes(operation),
        responseCount: definition.hooks.filter((hook) => hook.operation === operation).length,
      })),
      editRoute: (id, operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "variable", resourceTask: "variable", resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "variable", resourceTask: "variable", preferredOperation: operation } }),
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
      editRoute: (id, operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "computed", resourceTask: "computed", resourceId: id, preferredOperation: operation } }),
      createRoute: (operation) => ({ type: "feature", feature: "state", workspace: "definitions", data: { resourceKind: "computed", resourceTask: "computed", preferredOperation: operation } }),
    },
  ],
  conditions: [flagConditionAdapter, variableConditionAdapter],
  effects: [setFlagEffectAdapter, clearFlagEffectAdapter, setValueEffectAdapter, incrementEffectAdapter, decrementEffectAdapter],
  references: [stateProjectReferences],
  tools: stateAuthorTools,
  search: stateAuthorSearch,
  resources: [
    {
      kind: "variable",
      label: "Variable",
      pluralLabel: "Variables",
      list: (snapshot) => snapshot.variables.map((item) => ({ id: item.id, value: item.key, label: item.label || item.key, detail: item.valueType })),
      createRoute: () => stateResourceRoute("variable"),
      editRoute: (resource) => stateResourceRoute("variable", resource.id),
    },
    {
      kind: "number-variable",
      label: "Number Variable",
      pluralLabel: "Number Variables",
      searchable: false,
      list: (snapshot) => snapshot.variables.filter((item) => item.valueType === "number").map((item) => ({ id: item.id, value: item.key, label: item.label || item.key })),
      createRoute: () => stateResourceRoute("number-variable"),
      editRoute: (resource) => stateResourceRoute("number-variable", resource.id),
    },
    {
      kind: "flag",
      label: "Flag",
      pluralLabel: "Flags",
      searchable: false,
      list: (snapshot) => snapshot.variables.filter((item) => item.valueType === "boolean").map((item) => ({ id: item.id, value: item.key, label: item.label || item.key })),
      createRoute: () => stateResourceRoute("flag"),
      editRoute: (resource) => stateResourceRoute("flag", resource.id),
    },
    {
      kind: "computed",
      label: "Computed Value",
      pluralLabel: "Computed Values",
      list: (snapshot) => snapshot.computedValues.map((item) => ({ id: item.id, value: item.key, label: item.label || item.key, detail: item.source })),
      createRoute: () => stateResourceRoute("computed"),
      editRoute: (resource) => stateResourceRoute("computed", resource.id),
    },
    {
      kind: "character",
      label: "Character",
      pluralLabel: "Characters",
      list: (snapshot) => snapshot.entities.filter((item) => item.type === "character").map((item) => ({ id: item.id, value: item.id, label: item.name || item.key, detail: item.key })),
      createRoute: () => stateResourceRoute("character"),
      editRoute: (resource) => stateResourceRoute("character", resource.id),
    },
    {
      kind: "location",
      label: "Location",
      pluralLabel: "Locations",
      list: (snapshot) => snapshot.entities.filter((item) => item.type === "location").map((item) => ({ id: item.id, value: item.id, label: item.name || item.key, detail: item.key })),
      createRoute: () => stateResourceRoute("location"),
      editRoute: (resource) => stateResourceRoute("location", resource.id),
    },
  ],
  terminalShortcuts: [
    { commands: ["/definitions", "definitions"], route: DEFINITIONS_ROUTE },
  ],
  renderWorkspace(route, context) {
    if (route.type !== "feature" || route.feature !== "state" || route.workspace !== "definitions") return null;
    const resourceKind = route.data?.resourceKind as StateAuthorResourceKind | undefined;
    return <DefinitionsPanel
      snapshot={context.snapshot}
      resourceKind={resourceKind}
      resourceId={route.data?.resourceId}
      preferredOperation={route.data?.preferredOperation}
      onRegisterSave={context.registerWorkspaceSave}
      onSave={async (operations, description) => {
        const result = await context.persist(operations, description);
        if (!resourceKind || (result.status !== "saved" && result.status !== "queued")) return result;
        const variableOperation = operations.find((operation) => operation.type === "variable.upsert");
        if (variableOperation?.type === "variable.upsert") {
          context.completeTask({
            type: "resource",
            kind: resourceKind,
            id: variableOperation.definition.id,
            value: variableOperation.definition.key,
            label: variableOperation.definition.label || variableOperation.definition.key,
          });
          return result;
        }
        const computedOperation = operations.find((operation) => operation.type === "computed.upsert");
        if (computedOperation?.type === "computed.upsert") {
          context.completeTask({
            type: "resource",
            kind: "computed",
            id: computedOperation.definition.id,
            value: computedOperation.definition.key,
            label: computedOperation.definition.label || computedOperation.definition.key,
          });
          return result;
        }
        const entityOperation = operations.find((operation) => operation.type === "entity.upsert");
        if (entityOperation?.type === "entity.upsert") {
          context.completeTask({
            type: "resource",
            kind: entityOperation.entity.type,
            id: entityOperation.entity.id,
            value: entityOperation.entity.id,
            label: entityOperation.entity.name || entityOperation.entity.key,
          });
        }
        return result;
      }}
      onClose={context.hasParentTask ? context.leaveCurrentTask : undefined}
      setWorkspaceDirty={context.setWorkspaceDirty}
    />;
  },
};