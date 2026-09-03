import type { Condition } from "../../engine/rules/model";
import type { ComputedDefinition, StateGroupDefinition, StatePlayerPresentation, VariableDefinition } from "./model";
import type { StateProjectSlice } from "./projectSlice";

const ALWAYS: Condition = { type: "always" };
const LEGACY_STATUS_GROUP_ID = "legacy-status";

type LegacyPresentationFlag = { showInStatus?: boolean };

function legacyPresentation(order: number): StatePlayerPresentation {
  return { groupId: LEGACY_STATUS_GROUP_ID, order, visibleWhen: ALWAYS };
}

function stripLegacyFlag<T extends object>(definition: T & LegacyPresentationFlag): T {
  const { showInStatus: _legacyShowInStatus, ...current } = definition;
  return current as T;
}

/**
 * One-way client-cache normalization for snapshots written before State owned
 * player presentation groups. Durable D1 data is migrated by State migration 29;
 * this keeps an older browser cache semantically aligned until the server
 * snapshot refresh arrives and removes the obsolete cache-only flag as it goes.
 */
export function normalizeStateProjectSlice(snapshot: {
  variables: VariableDefinition[];
  computedValues: ComputedDefinition[];
  stateGroups?: StateGroupDefinition[];
}): StateProjectSlice {
  if (Array.isArray(snapshot.stateGroups)) {
    return {
      stateGroups: snapshot.stateGroups,
      variables: snapshot.variables.map((definition) => {
        const current = stripLegacyFlag(definition as VariableDefinition & LegacyPresentationFlag);
        return { ...current, playerPresentation: current.playerPresentation ?? null };
      }),
      computedValues: snapshot.computedValues.map((definition) => {
        const current = stripLegacyFlag(definition as ComputedDefinition & LegacyPresentationFlag);
        return { ...current, playerPresentation: current.playerPresentation ?? null };
      }),
    };
  }

  let order = 0;
  let hasLegacyPlayerPresentation = false;
  const variables = snapshot.variables.map((definition) => {
    const legacy = definition as VariableDefinition & LegacyPresentationFlag;
    const current = stripLegacyFlag(legacy);
    if (!legacy.showInStatus) return { ...current, playerPresentation: current.playerPresentation ?? null };
    hasLegacyPlayerPresentation = true;
    return { ...current, playerPresentation: current.playerPresentation ?? legacyPresentation(order++) };
  });
  const computedValues = snapshot.computedValues.map((definition) => {
    const legacy = definition as ComputedDefinition & LegacyPresentationFlag;
    const current = stripLegacyFlag(legacy);
    if (!legacy.showInStatus) return { ...current, playerPresentation: current.playerPresentation ?? null };
    hasLegacyPlayerPresentation = true;
    return { ...current, playerPresentation: current.playerPresentation ?? legacyPresentation(order++) };
  });

  return {
    variables,
    computedValues,
    stateGroups: hasLegacyPlayerPresentation
      ? [{ id: LEGACY_STATUS_GROUP_ID, label: "Status", order: 0, visibleWhen: ALWAYS }]
      : [],
  };
}
