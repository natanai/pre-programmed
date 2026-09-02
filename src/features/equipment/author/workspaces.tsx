import { ReferenceField } from "../../../author/resources/ReferenceField";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { AuthorTaskResult } from "../../../author/tasks/types";
import type { BodyTypeDefinition, EquipmentRuleDefinition, EquipmentSlotDefinition } from "../model";

function bodyRoute(id?: string, resourceTask = false) {
  return { type: "feature" as const, feature: "equipment", workspace: "body-type", data: { ...(id ? { bodyTypeId: id } : {}), ...(resourceTask ? { resourceTask: "body-type" } : {}) } };
}

export const equipmentLibraryWorkspace = defineAuthorWorkspace({
  id: "equipment-library",
  matches: (route) => route.type === "feature" && route.feature === "equipment" && route.workspace === "library",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "equipment-library", title: "Equipment", context: `${context.snapshot.bodyTypes.length} body types · ${context.snapshot.equipmentRules.length} item rules`,
    blocks: [{ type: "custom", id: "equipment-library-list", role: "results", content: <div className="author-ui-resource-list">
      <button type="button" onClick={() => context.pushTask(bodyRoute())}>[+ BODY TYPE]</button>
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "equipment", workspace: "rule" })}>[+ ITEM RULE]</button>
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "equipment", workspace: "settings" })}>[STARTING BODY]</button>
      {context.snapshot.bodyTypes.map((bodyType) => <button type="button" key={bodyType.id} onClick={() => context.pushTask(bodyRoute(bodyType.id))}>{bodyType.name || "Untitled body"} <small>{bodyType.slots.length} slots</small></button>)}
      {context.snapshot.equipmentRules.map((rule) => <button type="button" key={rule.itemId} onClick={() => context.pushTask({ type: "feature", feature: "equipment", workspace: "rule", data: { itemId: rule.itemId } })}>Rule: {context.snapshot.items.find((item) => item.id === rule.itemId)?.name || "Missing item"}</button>)}
    </div> }],
  }),
});

function newBody(): BodyTypeDefinition {
  return { id: crypto.randomUUID(), name: "", assetId: "", slots: [], startingEquipment: [] };
}

export const bodyTypeWorkspace = defineAuthorWorkspace<BodyTypeDefinition>({
  id: "equipment-body-type",
  matches: (route) => route.type === "feature" && route.feature === "equipment" && route.workspace === "body-type",
  createDraft: (route, context) => structuredClone(context.snapshot.bodyTypes.find((candidate) => candidate.id === route.data?.bodyTypeId) ?? newBody()),
  buildSpec: ({ context, draft, setDraft }) => {
    const openSlot = (slot?: EquipmentSlotDefinition) => context.pushTask({ type: "feature", feature: "equipment", workspace: "slot", data: slot ? { slot: JSON.stringify(slot) } : undefined }, (result?: AuthorTaskResult) => {
      if (result?.type !== "capability" || result.capability !== "equipment.slot" || !result.value || typeof result.value !== "object" || Array.isArray(result.value)) return;
      const next = result.value as unknown as EquipmentSlotDefinition;
      setDraft((current) => ({ ...current, slots: current.slots.some((candidate) => candidate.id === next.id) ? current.slots.map((candidate) => candidate.id === next.id ? next : candidate) : [...current.slots, next] }));
    });
    return {
      id: "equipment-body-type", title: draft.name || "New body type", context: `${draft.slots.length} slots`,
      blocks: [
        { type: "section", id: "body-type-identity", label: "Body type", importance: "primary", children: [
          { type: "field", id: "body-type-name", label: "Name", value: draft.name, autoFocus: !context.snapshot.bodyTypes.some((item) => item.id === draft.id), onChange: (name) => setDraft((current) => ({ ...current, name })) },
          { type: "custom", id: "body-type-image", role: "resource-picker", content: <ReferenceField kind="media-image" value={draft.assetId} onChange={(assetId) => setDraft((current) => ({ ...current, assetId }))} placeholder="No body image" /> },
        ] },
        { type: "custom", id: "body-type-slots", role: "ordered-list", content: <div className="author-ui-resource-list">
          <button type="button" onClick={() => openSlot()}>[+ SLOT]</button>
          {draft.slots.map((slot) => <button type="button" key={slot.id} onClick={() => openSlot(slot)}>{slot.name || slot.key}</button>)}
        </div> },
        { type: "disclosure", id: "body-starting-equipment", label: "Starting equipment", summary: `${draft.startingEquipment.length} assigned`, children: draft.slots.map((slot) => ({
          type: "custom" as const, id: `starting-${slot.id}`, role: "resource-picker" as const,
          content: <ReferenceField kind="item" value={draft.startingEquipment.find((assignment) => assignment.slotKey === slot.key)?.itemId ?? ""} placeholder={`Nothing in ${slot.name}`} onChange={(itemId) => setDraft((current) => ({ ...current, startingEquipment: itemId
            ? [...current.startingEquipment.filter((assignment) => assignment.slotKey !== slot.key), { slotKey: slot.key, itemId }]
            : current.startingEquipment.filter((assignment) => assignment.slotKey !== slot.key) }))} />,
        })) },
      ],
    };
  },
  async save({ route, context, draft }) {
    const result = await context.persist([{ type: "bodyType.upsert", bodyType: draft }], `Save body type ${draft.name || draft.id}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    return { accepted: true, ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: "body-type", id: draft.id, value: draft.id, label: draft.name || "Body type" } } : {}) };
  },
});

function newSlot(): EquipmentSlotDefinition {
  return { id: crypto.randomUUID(), key: "", name: "", x: 0, y: 0, width: 20, height: 20 };
}
export const equipmentSlotWorkspace = defineAuthorWorkspace<EquipmentSlotDefinition>({
  id: "equipment-slot",
  matches: (route) => route.type === "feature" && route.feature === "equipment" && route.workspace === "slot",
  createDraft: (route) => { try { return route.data?.slot ? JSON.parse(route.data.slot) as EquipmentSlotDefinition : newSlot(); } catch { return newSlot(); } },
  buildSpec: ({ draft, setDraft }) => ({
    id: "equipment-slot", title: draft.name || "New equipment slot", context: "Position is percentage of the body image",
    blocks: [{ type: "section", id: "equipment-slot-fields", label: "Slot", importance: "primary", children: [
      { type: "field", id: "slot-name", label: "Name", value: draft.name, autoFocus: !draft.name, onChange: (name) => setDraft((current) => ({ ...current, name })) },
      { type: "field", id: "slot-key", label: "Stable key", value: draft.key, placeholder: "left-hand", onChange: (key) => setDraft((current) => ({ ...current, key })) },
      { type: "field", id: "slot-x", label: "X %", control: "number", value: draft.x, onChange: (value) => setDraft((current) => ({ ...current, x: Number(value) })) },
      { type: "field", id: "slot-y", label: "Y %", control: "number", value: draft.y, onChange: (value) => setDraft((current) => ({ ...current, y: Number(value) })) },
      { type: "field", id: "slot-width", label: "Width %", control: "number", value: draft.width, onChange: (value) => setDraft((current) => ({ ...current, width: Math.max(1, Number(value)) })) },
      { type: "field", id: "slot-height", label: "Height %", control: "number", value: draft.height, onChange: (value) => setDraft((current) => ({ ...current, height: Math.max(1, Number(value)) })) },
    ] }],
  }),
  async save({ draft }) {
    if (!draft.name.trim()) return { accepted: false };
    const key = draft.key.trim() || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const saved = { ...draft, key };
    return { accepted: true, draft: saved, completion: { type: "capability" as const, capability: "equipment.slot", owner: "equipment", value: saved as any } };
  },
});

function newRule(snapshot: any): EquipmentRuleDefinition {
  return { itemId: snapshot.items[0]?.id ?? "", slotKeys: [], storage: "inventory", equipOnGiveSlotKey: null };
}
export const equipmentRuleWorkspace = defineAuthorWorkspace<EquipmentRuleDefinition>({
  id: "equipment-rule",
  matches: (route) => route.type === "feature" && route.feature === "equipment" && route.workspace === "rule",
  createDraft: (route, context) => structuredClone(context.snapshot.equipmentRules.find((candidate) => candidate.itemId === route.data?.itemId) ?? { ...newRule(context.snapshot), ...(route.data?.itemId ? { itemId: route.data.itemId } : {}) }),
  buildSpec: ({ context, draft, setDraft }) => {
    const slots = Array.from(new Map(context.snapshot.bodyTypes.flatMap((bodyType) => bodyType.slots).map((slot) => [slot.key, slot])).values());
    return {
      id: "equipment-rule", title: context.snapshot.items.find((item) => item.id === draft.itemId)?.name || "Equipment rule", context: "How this item equips",
      blocks: [
        { type: "section", id: "equipment-rule-main", label: "Equipment rule", importance: "primary", children: [
          { type: "custom", id: "equipment-rule-item", role: "resource-picker", content: <ReferenceField kind="item" value={draft.itemId} allowEmpty={false} onChange={(itemId) => setDraft((current) => ({ ...current, itemId }))} /> },
          { type: "choice", id: "equipment-storage", label: "While equipped", value: draft.storage, presentation: "segmented", onChange: (storage) => setDraft((current) => ({ ...current, storage: storage as EquipmentRuleDefinition["storage"] })), options: [{ value: "inventory", label: "STAYS IN INVENTORY" }, { value: "slot", label: "SLOT CARRIES IT" }] },
        ] },
        { type: "custom", id: "equipment-rule-slots", role: "specialized-control", content: <fieldset className="author-ui-choice"><legend>ALLOWED SLOTS</legend>
          <small>Leave every slot unchecked to allow any slot.</small>
          {slots.map((slot) => <label key={slot.key}><input type="checkbox" checked={draft.slotKeys.includes(slot.key)} onChange={(event) => setDraft((current) => ({ ...current, slotKeys: event.target.checked ? [...current.slotKeys, slot.key] : current.slotKeys.filter((key) => key !== slot.key) }))} /> {slot.name}</label>)}
        </fieldset> },
        { type: "custom", id: "equipment-auto-slot", role: "specialized-control", content: <label>AUTO-EQUIP WHEN GIVEN <select value={draft.equipOnGiveSlotKey ?? ""} onChange={(event) => setDraft((current) => ({ ...current, equipOnGiveSlotKey: event.target.value || null }))}><option value="">Off</option>{slots.map((slot) => <option value={slot.key} key={slot.key}>{slot.name}</option>)}</select></label> },
      ],
    };
  },
  async save({ context, draft }) {
    if (!draft.itemId) return { accepted: false };
    const result = await context.persist([{ type: "equipmentRule.upsert", rule: draft }], "Save equipment rule");
    return result.status === "saved" || result.status === "queued" ? { accepted: true } : { accepted: false };
  },
});

export const equipmentSettingsWorkspace = defineAuthorWorkspace<{ id: string }>({
  id: "equipment-settings",
  matches: (route) => route.type === "feature" && route.feature === "equipment" && route.workspace === "settings",
  createDraft: (_route, context) => ({ id: context.snapshot.startingBodyTypeId ?? "" }),
  buildSpec: ({ draft, setDraft }) => ({ id: "equipment-settings", title: "Starting body", context: "New playthrough default", blocks: [{ type: "section", id: "equipment-settings-main", label: "Starting body type", importance: "primary", children: [{ type: "custom", id: "equipment-starting-body", role: "resource-picker", content: <ReferenceField kind="body-type" value={draft.id} placeholder="No body type" onChange={(id) => setDraft({ id })} /> }] }] }),
  async save({ context, draft }) {
    const result = await context.persist([{ type: "bodyType.starting", id: draft.id || null }], "Save starting body type");
    return result.status === "saved" || result.status === "queued" ? { accepted: true } : { accepted: false };
  },
});

export const EQUIPMENT_WORKSPACES = [equipmentLibraryWorkspace, bodyTypeWorkspace, equipmentSlotWorkspace, equipmentRuleWorkspace, equipmentSettingsWorkspace] as const;
