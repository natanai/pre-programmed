import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { resolveAuthorKey } from "../../../author/generatedKey";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { AuthorUiNode } from "../../../author/ui/types";
import { DERIVED_VALUE_PROVIDERS } from "../../../engine/values/catalog";
import type { DerivedValueDefinition, ValueDefinition } from "../model";

function valueRoute(id?: string, resourceKind?: string) {
  return { type: "feature" as const, feature: "values", workspace: "value", data: { ...(id ? { resourceId: id } : {}), ...(resourceKind ? { resourceKind } : {}) } };
}
function derivedRoute(id?: string, resourceKind?: string) {
  return { type: "feature" as const, feature: "values", workspace: "derived-value", data: { ...(id ? { resourceId: id } : {}), ...(resourceKind ? { resourceKind } : {}) } };
}

export const valuesLibraryWorkspace = defineAuthorWorkspace({
  id: "values-library",
  matches: (route) => route.type === "feature" && route.feature === "values" && route.workspace === "library",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "values-library", title: "Values", context: `${context.snapshot.valueDefinitions.length} values · ${context.snapshot.derivedValueDefinitions.length} derived`,
    blocks: [{
      type: "custom", id: "values-list", role: "results", content: <div className="author-ui-resource-list">
        <button type="button" onClick={() => context.pushTask(valueRoute())}>[+ VALUE]</button>
        <button type="button" onClick={() => context.pushTask(derivedRoute())}>[+ DERIVED VALUE]</button>
        {context.snapshot.valueDefinitions.map((item) => <button type="button" key={item.id} onClick={() => context.pushTask(valueRoute(item.id))}>{item.label || item.key} <small>{item.valueType}</small></button>)}
        {context.snapshot.derivedValueDefinitions.map((item) => <button type="button" key={item.id} onClick={() => context.pushTask(derivedRoute(item.id))}>{item.label || item.key} <small>derived</small></button>)}
      </div>,
    }],
  }),
});

function defaultValue(resourceKind?: string): ValueDefinition {
  const valueType = resourceKind === "flag" ? "boolean" : "number";
  return {
    id: crypto.randomUUID(), key: "", label: "", valueType,
    initialValue: valueType === "boolean" ? false : 0,
    interactable: false, operations: [], hooks: [], timeRate: 0, timeUnit: "second",
  };
}

export const valueWorkspace = defineAuthorWorkspace<ValueDefinition>({
  id: "value",
  matches: (route) => route.type === "feature" && route.feature === "values" && route.workspace === "value",
  createDraft: (route, context) => structuredClone(context.snapshot.valueDefinitions.find((candidate) => candidate.id === route.data?.resourceId) ?? defaultValue(route.data?.resourceKind)),
  buildSpec: ({ context, draft, setDraft }) => {
    const initialNode: AuthorUiNode = draft.valueType === "boolean"
      ? { type: "choice", id: "value-initial-boolean", label: "Starts", value: String(Boolean(draft.initialValue)), presentation: "segmented", onChange: (value) => setDraft((current) => ({ ...current, initialValue: value === "true" })), options: [{ value: "true", label: "TRUE" }, { value: "false", label: "FALSE" }] }
      : { type: "field", id: "value-initial", label: "Starts at", control: draft.valueType === "number" ? "number" : "text", value: draft.initialValue === null ? "" : String(draft.initialValue), onChange: (value) => setDraft((current) => ({ ...current, initialValue: current.valueType === "number" ? Number(value) : value })) };
    return {
      id: "value", title: draft.label || "New value", context: draft.key || "Game value",
      blocks: [
        { type: "section", id: "value-identity", label: "Value", importance: "primary", children: [
          { type: "field", id: "value-label", label: "Name", value: draft.label, autoFocus: !context.snapshot.valueDefinitions.some((item) => item.id === draft.id), onChange: (label) => setDraft((current) => ({ ...current, label })) },
          { type: "field", id: "value-key", label: "Key", value: draft.key, placeholder: "generated from name", help: "Stable author key used by rules and text.", onChange: (key) => setDraft((current) => ({ ...current, key })) },
          { type: "choice", id: "value-type", label: "Type", value: draft.valueType, presentation: "segmented", onChange: (valueType) => setDraft((current) => ({ ...current, valueType: valueType as ValueDefinition["valueType"], initialValue: valueType === "boolean" ? false : valueType === "number" ? 0 : "" })), options: [
            { value: "number", label: "NUMBER" }, { value: "boolean", label: "TRUE / FALSE" }, { value: "string", label: "TEXT" },
          ] },
          initialNode,
        ] },
        ...(draft.valueType === "number" ? [{ type: "disclosure" as const, id: "value-time", label: "Change over time", summary: Number(draft.timeRate ?? 0) ? `${draft.timeRate} per ${draft.timeUnit}` : "Off", children: [
          { type: "field" as const, id: "value-time-rate", label: "Change", control: "number" as const, value: draft.timeRate ?? 0, help: "Use a negative number to decrease over time.", onChange: (value: string) => setDraft((current) => ({ ...current, timeRate: Number(value) })) },
          { type: "choice" as const, id: "value-time-unit", label: "Per", value: draft.timeUnit ?? "second", presentation: "segmented" as const, onChange: (timeUnit: string) => setDraft((current) => ({ ...current, timeUnit: timeUnit as ValueDefinition["timeUnit"] })), options: [{ value: "second", label: "SECOND" }, { value: "minute", label: "MINUTE" }, { value: "hour", label: "HOUR" }] },
        ] }] : []),
        { type: "disclosure", id: "value-behavior", label: "Player interactions", summary: draft.interactable ? `${draft.operations.length} operations` : "Not directly interactable", children: [{
          type: "custom", id: "value-operations", role: "specialized-control", content: <OperationHooksEditor
            capability={{ interactable: draft.interactable, operations: draft.operations, hooks: draft.hooks }}
            snapshot={context.snapshot} targetKind="values.value"
            onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))}
          />,
        }] },
      ],
    };
  },
  async save({ route, context, draft }) {
    const key = resolveAuthorKey({ override: draft.key, source: draft.label, existingKeys: context.snapshot.valueDefinitions.filter((item) => item.id !== draft.id).map((item) => item.key), fallback: "value" });
    const saved = { ...draft, key };
    const result = await context.persist([{ type: "value.upsert", definition: saved }], `Save value ${saved.label || key}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    const resourceKind = route.data?.resourceKind;
    return {
      accepted: true, draft: saved,
      ...(resourceKind ? { completion: { type: "resource" as const, kind: resourceKind, id: saved.id, value: resourceKind === "value-definition" ? saved.id : saved.key, label: saved.label || saved.key } } : {}),
    };
  },
});

function defaultDerived(): DerivedValueDefinition {
  const provider = DERIVED_VALUE_PROVIDERS[0];
  return { id: crypto.randomUUID(), key: "", label: "", source: { provider: provider?.id ?? "session", metric: provider?.metrics[0]?.id ?? "elapsed_seconds" }, format: "raw", interactable: false, operations: [], hooks: [] };
}

export const derivedValueWorkspace = defineAuthorWorkspace<DerivedValueDefinition>({
  id: "derived-value",
  matches: (route) => route.type === "feature" && route.feature === "values" && route.workspace === "derived-value",
  createDraft: (route, context) => structuredClone(context.snapshot.derivedValueDefinitions.find((candidate) => candidate.id === route.data?.resourceId) ?? defaultDerived()),
  buildSpec: ({ context, draft, setDraft }) => {
    const provider = DERIVED_VALUE_PROVIDERS.find((candidate) => candidate.id === draft.source.provider) ?? DERIVED_VALUE_PROVIDERS[0];
    return {
      id: "derived-value", title: draft.label || "New derived value", context: "Read-only runtime metric",
      blocks: [
        { type: "section", id: "derived-identity", label: "Derived value", importance: "primary", children: [
          { type: "field", id: "derived-label", label: "Name", value: draft.label, autoFocus: !context.snapshot.derivedValueDefinitions.some((item) => item.id === draft.id), onChange: (label) => setDraft((current) => ({ ...current, label })) },
          { type: "field", id: "derived-key", label: "Key", value: draft.key, placeholder: "generated from name", onChange: (key) => setDraft((current) => ({ ...current, key })) },
          { type: "choice", id: "derived-provider", label: "Source", value: draft.source.provider, onChange: (providerId) => {
            const next = DERIVED_VALUE_PROVIDERS.find((candidate) => candidate.id === providerId);
            setDraft((current) => ({ ...current, source: { provider: providerId, metric: next?.metrics[0]?.id ?? "" } }));
          }, options: DERIVED_VALUE_PROVIDERS.map((candidate) => ({ value: candidate.id, label: candidate.label })) },
          { type: "choice", id: "derived-metric", label: "Metric", value: draft.source.metric, onChange: (metric) => setDraft((current) => ({ ...current, source: { ...current.source, metric } })), options: (provider?.metrics ?? []).map((metric) => ({ value: metric.id, label: metric.label })) },
          { type: "choice", id: "derived-format", label: "Display format", value: draft.format, presentation: "segmented", onChange: (format) => setDraft((current) => ({ ...current, format: format as DerivedValueDefinition["format"] })), options: [{ value: "raw", label: "RAW" }, { value: "integer", label: "INTEGER" }, { value: "seconds", label: "SECONDS" }] },
        ] },
        { type: "disclosure", id: "derived-behavior", label: "Player interactions", summary: draft.interactable ? `${draft.operations.length} operations` : "Not directly interactable", children: [{ type: "custom", id: "derived-operations", role: "specialized-control", content: <OperationHooksEditor capability={{ interactable: draft.interactable, operations: draft.operations, hooks: draft.hooks }} snapshot={context.snapshot} targetKind="values.derived" onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))} /> }] },
      ],
    };
  },
  async save({ route, context, draft }) {
    const key = resolveAuthorKey({ override: draft.key, source: draft.label, existingKeys: context.snapshot.derivedValueDefinitions.filter((item) => item.id !== draft.id).map((item) => item.key), fallback: "derived" });
    const saved = { ...draft, key };
    const result = await context.persist([{ type: "derivedValue.upsert", definition: saved }], `Save derived value ${saved.label || key}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    const resourceKind = route.data?.resourceKind;
    return { accepted: true, draft: saved, ...(resourceKind ? { completion: { type: "resource" as const, kind: resourceKind, id: saved.id, value: resourceKind === "derived-definition" ? saved.id : saved.key, label: saved.label || saved.key } } : {}) };
  },
});

export const VALUES_WORKSPACES = [valuesLibraryWorkspace, valueWorkspace, derivedValueWorkspace] as const;
