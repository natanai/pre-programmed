import type { Condition, Effect } from "../../engine/rules/model";
import { scanInlineTextCommands } from "../../engine/presentation/inlineTextCommandCatalog";
import type { ProjectSnapshot } from "../../engine/project/model";
import {
  getAuthorConditionAdapters,
  getAuthorEffectAdapters,
  getAuthorReferenceContributions,
  getAuthorResourceProvider,
  getAuthorTextCueAdapters,
} from "../features/registry";
import type { ProjectReference, ProjectReferenceContext, ResourceReference } from "./types";

function conditionReferences(condition: Condition): readonly ResourceReference[] {
  if (condition.type === "all" || condition.type === "any") {
    return condition.conditions.flatMap(conditionReferences);
  }
  if (condition.type === "not") return conditionReferences(condition.condition);
  return getAuthorConditionAdapters().find((adapter) => adapter.type === condition.type)?.references?.(condition) ?? [];
}

function effectReferences(effects: readonly Effect[]): readonly ResourceReference[] {
  return effects.flatMap((effect) => getAuthorEffectAdapters()
    .find((adapter) => adapter.type === effect.type)?.references?.(effect) ?? []);
}

function textReferences(text: string, snapshot: ProjectSnapshot): readonly ResourceReference[] {
  return scanInlineTextCommands(text).flatMap((command) => getAuthorTextCueAdapters()
    .find((adapter) => adapter.inlineCode === command.definition.code)?.references?.(command.value, snapshot) ?? []);
}

function referenceContext(snapshot: ProjectSnapshot): ProjectReferenceContext {
  return {
    condition: conditionReferences,
    effects: effectReferences,
    text: (text) => textReferences(text, snapshot),
  };
}

export function buildProjectReferences(snapshot: ProjectSnapshot): ProjectReference[] {
  const context = referenceContext(snapshot);
  return getAuthorReferenceContributions().flatMap((contribute) => contribute(snapshot, context));
}

export function referencesTo(snapshot: ProjectSnapshot, resourceKind: string, resourceId: string): ProjectReference[] {
  return buildProjectReferences(snapshot).filter((reference) =>
    reference.resourceKind === resourceKind && reference.resourceId === resourceId);
}

export function missingProjectReferences(snapshot: ProjectSnapshot): ProjectReference[] {
  return buildProjectReferences(snapshot).filter((reference) => {
    if (!reference.resourceId) return false;
    const provider = getAuthorResourceProvider(reference.resourceKind);
    if (!provider) return false;
    return !provider.list(snapshot).some((resource) =>
      resource.id === reference.resourceId || resource.value === reference.resourceId);
  });
}
