import type { AuthorFeatureManifest } from "../../../author/features/types";
import { DefinitionsPanel, type StateAuthorResourceKind } from "./DefinitionsPanel";
import { stateAuthorSearch, stateAuthorTools } from "./tools";
import { STATE_COMMAND_REFERENCE_SOURCES } from "../commandReferences";
import { WORLD_COMMAND_REFERENCE_SOURCES } from "../../world/commandReferences";
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
      ...(id ? { resourceId: id } : {}),
    },
  };
}

export const stateAuthorFeature: AuthorFeatureManifest = {
  id: "state",
  commandReferences: [...WORLD_COMMAND_REFERENCE_SOURCES, ...STATE_COMMAND_REFERENCE_SOURCES],
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
      onClose={context.leaveCurrentTask}
      setWorkspaceDirty={context.setWorkspaceDirty}
    />;
  },
};
