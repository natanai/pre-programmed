import { GeneratedKeyField } from "../../../author/GeneratedKeyField";
import { OperationHooksEditor } from "../../../author/operations/OperationHooksEditor";
import { referencesTo } from "../../../author/references/projectReferences";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { AuthorTaskResult } from "../../../author/tasks/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { AuthorWorkspaceSpec } from "../../../author/ui/types";
import { resolveAuthorKey } from "../../../author/generatedKey";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { EquipmentPlacementDefinition, ItemDefinition } from "../model";
import "./inventoryAuthor.css";

const DEFAULT_ITEM_OPERATIONS = ["inspect", "use", "move", "remove", "equip", "unequip"] as const;
const EQUIPMENT_POLICY_CAPABILITY = "inventory.item-equipment-draft";
const EQUIPMENT_PLACEMENT_CAPABILITY = "inventory.item-equipment-placement-draft";

type SlotOption = {
  key: string;
  label: string;
  detail: string;
};

type EquipmentPolicyDraft = {
  mode: "any" | "placements";
  placements: EquipmentPlacementDefinition[];
  equippedStorage: "inventory" | "slot";
  equipOnGiveSlotKey: string | null;
};

type PlacementDraft = EquipmentPlacementDefinition;

function emptyItem(): ItemDefinition {
  return {
    id: crypto.randomUUID(),
    key: "",
    name: "",
    description: "",
    assetId: "",
    width: 1,
    height: 1,
    stackable: false,
    maxStack: 1,
    removable: true,
    startingQuantity: 1,
    interactable: true,
    operations: [...DEFAULT_ITEM_OPERATIONS],
    equipmentPlacements: [],
    equippedStorage: "inventory",
    equipOnGiveSlotKey: null,
    tags: [],
    initialState: {},
    hooks: [],
  };
}

function cloneItem(item: ItemDefinition): ItemDefinition {
  return {
    ...structuredClone(item),
    equipmentPlacements: (item.equipmentPlacements ?? []).map((placement) => ({
      ...placement,
      occupiedSlotKeys: [...placement.occupiedSlotKeys],
    })),
    equippedStorage: item.equippedStorage ?? "inventory",
    equipOnGiveSlotKey: item.equipOnGiveSlotKey ?? null,
  };
}

function slotOptions(snapshot: ProjectSnapshot, extraKeys: readonly string[] = []): SlotOption[] {
  const slots = new Map<string, { labels: Set<string>; bodies: Set<string> }>();
  for (const bodyType of snapshot.bodyBackgrounds ?? []) {
    for (const slot of bodyType.slots ?? []) {
      const current = slots.get(slot.key) ?? { labels: new Set<string>(), bodies: new Set<string>() };
      current.labels.add(slot.name || slot.key);
      current.bodies.add(bodyType.name || "Untitled body type");
      slots.set(slot.key, current);
    }
  }
  for (const key of extraKeys) {
    if (!key || slots.has(key)) continue;
    slots.set(key, { labels: new Set([key]), bodies: new Set() });
  }
  return [...slots.entries()]
    .map(([key, value]) => ({
      key,
      label: [...value.labels].join(" / ") || key,
      detail: value.bodies.size ? [...value.bodies].join(", ") : "missing from current body types",
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key));
}

function slotLabel(options: readonly SlotOption[], key: string) {
  return options.find((option) => option.key === key)?.label ?? key;
}

function uniqueKeys(keys: readonly string[]) {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

function normalizedPlacement(placement: EquipmentPlacementDefinition): EquipmentPlacementDefinition {
  const anchorSlotKey = placement.anchorSlotKey.trim();
  return {
    anchorSlotKey,
    occupiedSlotKeys: uniqueKeys([anchorSlotKey, ...placement.occupiedSlotKeys]),
  };
}

function normalizePlacements(placements: readonly EquipmentPlacementDefinition[]) {
  const byAnchor = new Map<string, EquipmentPlacementDefinition>();
  for (const raw of placements) {
    const placement = normalizedPlacement(raw);
    if (placement.anchorSlotKey) byAnchor.set(placement.anchorSlotKey, placement);
  }
  return [...byAnchor.values()];
}

function policyForItem(item: ItemDefinition): EquipmentPolicyDraft {
  const placements = normalizePlacements(item.equipmentPlacements ?? []);
  return {
    mode: placements.length ? "placements" : "any",
    placements,
    equippedStorage: item.equippedStorage ?? "inventory",
    equipOnGiveSlotKey: item.equipOnGiveSlotKey ?? null,
  };
}

function safeParseObject(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parsePlacements(value: unknown): EquipmentPlacementDefinition[] {
  if (!Array.isArray(value)) return [];
  return normalizePlacements(value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const record = candidate as Record<string, unknown>;
    if (typeof record.anchorSlotKey !== "string" || !Array.isArray(record.occupiedSlotKeys)) return [];
    if (!record.occupiedSlotKeys.every((key) => typeof key === "string")) return [];
    return [{
      anchorSlotKey: record.anchorSlotKey,
      occupiedSlotKeys: record.occupiedSlotKeys as string[],
    }];
  }));
}

function policyFromRoute(raw: string | undefined): EquipmentPolicyDraft {
  const parsed = safeParseObject(raw);
  const placements = parsePlacements(parsed?.placements);
  const equippedStorage = parsed?.equippedStorage === "slot" ? "slot" : "inventory";
  const equipOnGiveSlotKey = typeof parsed?.equipOnGiveSlotKey === "string" ? parsed.equipOnGiveSlotKey : null;
  return {
    mode: placements.length ? "placements" : "any",
    placements,
    equippedStorage,
    equipOnGiveSlotKey,
  };
}

function placementFromRoute(raw: string | undefined, options: readonly SlotOption[]): PlacementDraft {
  const parsed = safeParseObject(raw);
  const anchorSlotKey = typeof parsed?.anchorSlotKey === "string"
    ? parsed.anchorSlotKey
    : options[0]?.key ?? "";
  const occupied = Array.isArray(parsed?.occupiedSlotKeys) && parsed.occupiedSlotKeys.every((key) => typeof key === "string")
    ? parsed.occupiedSlotKeys as string[]
    : [];
  return normalizedPlacement({ anchorSlotKey, occupiedSlotKeys: occupied });
}

function capabilityValue(result: AuthorTaskResult | undefined, capability: string) {
  return result?.type === "capability" && result.owner === "inventory" && result.capability === capability
    ? result.value
    : undefined;
}

function placementFromResult(result: AuthorTaskResult | undefined) {
  const value = capabilityValue(result, EQUIPMENT_PLACEMENT_CAPABILITY);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.anchorSlotKey !== "string" || !Array.isArray(record.occupiedSlotKeys)) return null;
  if (!record.occupiedSlotKeys.every((key) => typeof key === "string")) return null;
  return normalizedPlacement({
    anchorSlotKey: record.anchorSlotKey,
    occupiedSlotKeys: record.occupiedSlotKeys as string[],
  });
}

function policyFromResult(result: AuthorTaskResult | undefined) {
  const value = capabilityValue(result, EQUIPMENT_POLICY_CAPABILITY);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const placements = parsePlacements(record.placements);
  const equippedStorage = record.equippedStorage === "slot" ? "slot" : record.equippedStorage === "inventory" ? "inventory" : null;
  if (!equippedStorage) return null;
  const equipOnGiveSlotKey = typeof record.equipOnGiveSlotKey === "string" ? record.equipOnGiveSlotKey : null;
  return { placements, equippedStorage, equipOnGiveSlotKey };
}

function equipmentSummary(item: ItemDefinition, snapshot: ProjectSnapshot) {
  const placements = item.equipmentPlacements ?? [];
  if (!placements.length) return "Any body slot · occupies chosen slot only";
  const options = slotOptions(snapshot, placements.flatMap((placement) => placement.occupiedSlotKeys));
  const maxSlots = Math.max(1, ...placements.map((placement) => placement.occupiedSlotKeys.length));
  const anchors = placements.slice(0, 2).map((placement) => slotLabel(options, placement.anchorSlotKey));
  const suffix = placements.length > 2 ? ` +${placements.length - 2}` : "";
  return `${anchors.join(" / ")}${suffix} · up to ${maxSlots} occupied slot${maxSlots === 1 ? "" : "s"}`;
}

function EquipmentPolicyLauncher({
  item,
  snapshot,
  onOpen,
}: {
  item: ItemDefinition;
  snapshot: ProjectSnapshot;
  onOpen: () => void;
}) {
  return <div className="equipment-policy-launcher">
    <span>{equipmentSummary(item, snapshot)}</span>
    <small>Equipment placements define where the item can anchor and every body slot that placement reserves.</small>
    <button type="button" onClick={onOpen}>[CONFIGURE EQUIPMENT]</button>
  </div>;
}

function PlacementList({
  placements,
  options,
  onAdd,
  onEdit,
  onRemove,
}: {
  placements: EquipmentPlacementDefinition[];
  options: SlotOption[];
  onAdd: () => void;
  onEdit: (placement: EquipmentPlacementDefinition) => void;
  onRemove: (anchorSlotKey: string) => void;
}) {
  return <div className="equipment-placement-list">
    <div className="equipment-placement-toolbar">
      <button type="button" onClick={onAdd}>[+ PLACEMENT]</button>
      <small>Each anchor may have one placement. A placement can reserve one slot or several.</small>
    </div>
    {placements.length ? <div className="equipment-placement-cards">
      {placements.map((placement) => <article className="equipment-placement-card" key={placement.anchorSlotKey}>
        <button type="button" className="equipment-placement-open" onClick={() => onEdit(placement)}>
          <span>ANCHOR</span>
          <strong>{slotLabel(options, placement.anchorSlotKey)}</strong>
          <small>{placement.occupiedSlotKeys.map((key) => slotLabel(options, key)).join(" + ")}</small>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" className="danger equipment-placement-remove" onClick={() => onRemove(placement.anchorSlotKey)}>[REMOVE]</button>
      </article>)}
    </div> : <p className="field-help">No placements yet. Add one for each slot where the item may anchor.</p>}
  </div>;
}

function OccupiedSlotsControl({
  draft,
  options,
  onChange,
}: {
  draft: PlacementDraft;
  options: SlotOption[];
  onChange: (occupiedSlotKeys: string[]) => void;
}) {
  return <div className="equipment-occupied-control">
    <p className="field-help">The anchor is always occupied. Select every additional body slot that becomes unavailable while this placement is equipped.</p>
    <div className="equipment-slot-grid">
      {options.map((option) => {
        const anchor = option.key === draft.anchorSlotKey;
        const checked = anchor || draft.occupiedSlotKeys.includes(option.key);
        return <label className="check-label" key={option.key}>
          <input
            type="checkbox"
            checked={checked}
            disabled={anchor}
            onChange={(event) => onChange(event.target.checked
              ? uniqueKeys([...draft.occupiedSlotKeys, option.key])
              : draft.occupiedSlotKeys.filter((key) => key !== option.key))}
          />
          <span>{option.label}</span>
          <small>{anchor ? "anchor" : option.key}</small>
        </label>;
      })}
    </div>
  </div>;
}

function EquipOnGiveControl({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: SlotOption[];
  onChange: (slotKey: string | null) => void;
}) {
  return <label className="equipment-select-field">
    <span>WHEN GIVEN TO PLAYER</span>
    <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">keep in general inventory</option>
      {options.map((option) => <option value={option.key} key={option.key}>equip to {option.label}</option>)}
    </select>
    <small>Equips one newly granted instance through this placement. Starting equipment is configured on each body type.</small>
  </label>;
}

export const itemWorkspace = defineAuthorWorkspace<ItemDefinition>({
  id: "inventory-item",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "item",
  createDraft(route, context) {
    const initial = route.type === "feature" && route.data?.itemId
      ? context.snapshot.items.find((candidate) => candidate.id === route.data?.itemId)
      : undefined;
    return cloneItem(initial ?? emptyItem());
  },
  canSave: ({ draft }) => Boolean(draft.name.trim()),
  buildSpec({ route, context, draft, setDraft }): AuthorWorkspaceSpec {
    const initialId = route.type === "feature" ? route.data?.itemId : undefined;
    const usages = initialId
      ? referencesTo(context.snapshot, "item", initialId).filter((reference) => reference.ownerId !== initialId)
      : [];
    const minimumStartingQuantity = Math.max(0, ...(context.snapshot.bodyBackgrounds ?? []).map((bodyType) =>
      (bodyType.startingEquipment ?? []).filter((assignment) => assignment.itemId === draft.id).length,
    ));
    const openOperations = route.type === "feature" && route.data?.section === "operations";
    const preferredOperation = route.type === "feature" ? route.data?.operation : undefined;

    const openEquipment = () => {
      context.pushTask({
        type: "feature",
        feature: "inventory",
        workspace: "item-equipment",
        data: {
          itemName: draft.name || "Item",
          policy: JSON.stringify({
            placements: draft.equipmentPlacements ?? [],
            equippedStorage: draft.equippedStorage ?? "inventory",
            equipOnGiveSlotKey: draft.equipOnGiveSlotKey ?? null,
          }),
        },
      }, (result) => {
        const policy = policyFromResult(result);
        if (!policy) return;
        setDraft((current) => ({ ...current, ...policy }));
      });
    };

    return {
      id: "inventory-item",
      title: `ITEM · ${draft.name || "NEW"}`,
      context: draft.key || undefined,
      blocks: [
        {
          type: "section",
          id: "item-identity",
          label: "IDENTITY",
          importance: "primary",
          children: [
            {
              type: "field",
              id: "item-name",
              label: "NAME",
              value: draft.name,
              onChange: (name) => setDraft((current) => ({ ...current, name })),
              autoFocus: !initialId,
            },
            {
              type: "field",
              id: "item-description",
              label: "DESCRIPTION",
              control: "textarea",
              rows: 3,
              value: draft.description,
              onChange: (description) => setDraft((current) => ({ ...current, description })),
            },
            {
              type: "custom",
              id: "item-key",
              role: "specialized-control",
              content: <GeneratedKeyField source={draft.name} value={draft.key} onChange={(key) => setDraft((current) => ({ ...current, key }))} />,
            },
            {
              type: "field",
              id: "item-tags",
              label: "TAGS",
              value: draft.tags.join(", "),
              onChange: (tags) => setDraft((current) => ({
                ...current,
                tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
              })),
              help: "Comma-separated search and authoring tags.",
            },
          ],
        },
        {
          type: "disclosure",
          id: "item-inventory-tile",
          label: "INVENTORY TILE",
          summary: `${draft.width}×${draft.height} · start ${draft.startingQuantity ?? 0}${draft.stackable ? " · stackable" : ""}`,
          children: [
            {
              type: "custom",
              id: "item-asset",
              role: "resource-picker",
              content: <div className="equipment-resource-field"><span>ASSET</span><ReferenceField kind="media-image" value={draft.assetId} onChange={(assetId) => setDraft((current) => ({ ...current, assetId }))} placeholder="none / text tile" /></div>,
            },
            {
              type: "field",
              id: "item-width",
              label: "WIDTH",
              control: "number",
              inputMode: "numeric",
              value: draft.width,
              onChange: (value) => setDraft((current) => ({ ...current, width: Math.max(1, Math.min(10, Math.floor(Number(value) || 1))) })),
            },
            {
              type: "field",
              id: "item-height",
              label: "HEIGHT",
              control: "number",
              inputMode: "numeric",
              value: draft.height,
              onChange: (value) => setDraft((current) => ({ ...current, height: Math.max(1, Math.min(6, Math.floor(Number(value) || 1))) })),
            },
            {
              type: "choice",
              id: "item-stackable",
              label: "STACKING",
              value: draft.stackable ? "stack" : "single",
              presentation: "segmented",
              onChange: (value) => setDraft((current) => ({ ...current, stackable: value === "stack", maxStack: value === "stack" ? Math.max(1, current.maxStack) : 1 })),
              options: [
                { value: "single", label: "single instances" },
                { value: "stack", label: "stackable" },
              ],
            },
            ...(draft.stackable ? [{
              type: "field" as const,
              id: "item-max-stack",
              label: "MAX STACK",
              control: "number" as const,
              inputMode: "numeric" as const,
              value: draft.maxStack,
              onChange: (value: string) => setDraft((current) => ({ ...current, maxStack: Math.max(1, Math.floor(Number(value) || 1)) })),
            }] : []),
            {
              type: "field",
              id: "item-starting-quantity",
              label: "STARTING QUANTITY",
              control: "number",
              inputMode: "numeric",
              value: draft.startingQuantity ?? 0,
              onChange: (value) => setDraft((current) => ({
                ...current,
                startingQuantity: Math.max(minimumStartingQuantity, Math.floor(Number(value) || 0)),
              })),
              help: `Total in a new playthrough, including equipped loadout instances.${minimumStartingQuantity ? ` At least ${minimumStartingQuantity} required by body-type loadouts.` : ""}`,
            },
            {
              type: "choice",
              id: "item-removable",
              label: "REMOVE WITHOUT A RESPONSE",
              value: draft.removable ? "yes" : "no",
              presentation: "segmented",
              onChange: (value) => setDraft((current) => ({ ...current, removable: value === "yes" })),
              options: [
                { value: "yes", label: "allowed" },
                { value: "no", label: "requires response" },
              ],
            },
          ],
        },
        {
          type: "section",
          id: "item-equipment",
          label: "EQUIPMENT",
          summary: equipmentSummary(draft, context.snapshot),
          children: [
            {
              type: "status",
              id: "item-equipment-help",
              text: "Equipment is authored as placements: choose an anchor, then reserve every slot that item occupies there.",
            },
            {
              type: "custom",
              id: "item-equipment-launcher",
              role: "specialized-control",
              content: <EquipmentPolicyLauncher item={draft} snapshot={context.snapshot} onOpen={openEquipment} />,
            },
          ],
        },
        {
          type: "disclosure",
          id: "item-player-behavior",
          label: "PLAYER BEHAVIOR",
          summary: `${(draft.operations ?? []).length} operations · ${(draft.hooks ?? []).length} responses`,
          defaultOpen: openOperations || Boolean(preferredOperation),
          children: [{
            type: "custom",
            id: "item-operation-hooks",
            role: "rule-editor",
            content: <OperationHooksEditor
              snapshot={context.snapshot}
              targetKind="inventory.item"
              defaultOpen={openOperations || Boolean(preferredOperation)}
              preferredOperation={preferredOperation}
              capability={{
                interactable: draft.interactable ?? true,
                operations: draft.operations ?? [...DEFAULT_ITEM_OPERATIONS],
                hooks: draft.hooks ?? [],
              }}
              onChange={(capability) => setDraft((current) => ({ ...current, ...capability }))}
            />,
          }],
        },
        ...(!draft.name.trim() ? [{
          type: "status" as const,
          id: "item-name-required",
          text: "Give the item a name before saving.",
          tone: "warning" as const,
        }] : []),
      ],
      actions: initialId ? [{
        id: "delete-item",
        label: usages.length ? `DELETE · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : "DELETE",
        tone: "danger",
        disabled: usages.length > 0,
        onAction: () => {
          if (usages.length || !window.confirm(`Delete item “${draft.name}”?`)) return;
          void context.persist([{ type: "item.delete", id: draft.id }], `Deleted item ${draft.name}`).then((result) => {
            if ((result.status === "saved" || result.status === "queued") && context.hasParentTask) {
              context.completeTask({ type: "saved" });
            }
          });
        },
      }] : [],
    };
  },
  async save({ route, context, draft }) {
    const name = draft.name.trim();
    if (!name) return { accepted: false };
    const equipmentPlacements = normalizePlacements(draft.equipmentPlacements ?? []);
    const equipOnGiveSlotKey = equipmentPlacements.length && draft.equipOnGiveSlotKey
      && !equipmentPlacements.some((placement) => placement.anchorSlotKey === draft.equipOnGiveSlotKey)
      ? null
      : draft.equipOnGiveSlotKey ?? null;
    const item: ItemDefinition = {
      ...draft,
      name,
      key: resolveAuthorKey({
        override: draft.key,
        source: name,
        existingKeys: context.snapshot.items.filter((candidate) => candidate.id !== draft.id).map((candidate) => candidate.key),
        fallback: "item",
      }),
      equipmentPlacements,
      equippedStorage: draft.equippedStorage ?? "inventory",
      equipOnGiveSlotKey,
    };
    const result = await context.persist([{ type: "item.upsert", item }], `${route.type === "feature" && route.data?.itemId ? "Changed" : "Created"} item ${item.name}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    const completion = route.type === "feature" && route.data?.resourceTask === "item"
      ? {
        type: "resource" as const,
        kind: "item",
        id: item.id,
        value: item.id,
        label: item.name || item.key || "Untitled item",
      }
      : undefined;
    return { accepted: true, draft: item, completion };
  },
});

export const equipmentPolicyWorkspace = defineAuthorWorkspace<EquipmentPolicyDraft>({
  id: "inventory-item-equipment",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "item-equipment",
  createDraft(route) {
    return policyFromRoute(route.type === "feature" ? route.data?.policy : undefined);
  },
  buildSpec({ route, context, draft, setDraft }): AuthorWorkspaceSpec {
    const extraKeys = draft.placements.flatMap((placement) => placement.occupiedSlotKeys);
    const options = slotOptions(context.snapshot, extraKeys);
    const placementAnchors = new Set(draft.placements.map((placement) => placement.anchorSlotKey));
    const giveOptions = draft.mode === "placements"
      ? options.filter((option) => placementAnchors.has(option.key))
      : options;

    const applyPlacement = (placement: EquipmentPlacementDefinition, originalAnchor?: string) => {
      setDraft((current) => ({
        ...current,
        mode: "placements",
        placements: [
          ...current.placements.filter((candidate) => candidate.anchorSlotKey !== originalAnchor && candidate.anchorSlotKey !== placement.anchorSlotKey),
          placement,
        ],
      }));
    };

    const openPlacement = (placement?: EquipmentPlacementDefinition) => {
      context.pushTask({
        type: "feature",
        feature: "inventory",
        workspace: "item-equipment-placement",
        data: {
          itemName: route.type === "feature" ? route.data?.itemName ?? "Item" : "Item",
          ...(placement ? { placement: JSON.stringify(placement) } : {}),
        },
      }, (result) => {
        const next = placementFromResult(result);
        if (next) applyPlacement(next, placement?.anchorSlotKey);
      });
    };

    return {
      id: "inventory-item-equipment",
      title: "EQUIPMENT",
      context: route.type === "feature" ? route.data?.itemName : undefined,
      blocks: [
        {
          type: "section",
          id: "equipment-fit",
          label: "FIT",
          importance: "primary",
          children: [
            {
              type: "choice",
              id: "equipment-fit-mode",
              label: "PLACEMENTS",
              value: draft.mode,
              presentation: "segmented",
              onChange: (mode) => setDraft((current) => ({
                ...current,
                mode: mode === "placements" ? "placements" : "any",
                equipOnGiveSlotKey: mode === "placements" && current.equipOnGiveSlotKey
                  && !current.placements.some((placement) => placement.anchorSlotKey === current.equipOnGiveSlotKey)
                  ? null
                  : current.equipOnGiveSlotKey,
              })),
              options: [
                { value: "any", label: "any single slot", help: "May anchor in any body slot and occupies only that slot." },
                { value: "placements", label: "defined placements", help: "Choose exact anchors and every slot each placement occupies." },
              ],
            },
            ...(draft.mode === "placements" ? [{
              type: "custom" as const,
              id: "equipment-placement-list",
              role: "ordered-list" as const,
              content: <PlacementList
                placements={draft.placements}
                options={options}
                onAdd={() => openPlacement()}
                onEdit={(placement) => openPlacement(placement)}
                onRemove={(anchorSlotKey) => setDraft((current) => ({
                  ...current,
                  placements: current.placements.filter((placement) => placement.anchorSlotKey !== anchorSlotKey),
                  equipOnGiveSlotKey: current.equipOnGiveSlotKey === anchorSlotKey ? null : current.equipOnGiveSlotKey,
                }))}
              />,
            }] : []),
            ...(!options.length ? [{
              type: "status" as const,
              id: "equipment-no-slots",
              text: "No body slots exist yet. Any-single-slot mode remains future-compatible; defined placements can be added after body slots are authored.",
              tone: "info" as const,
            }] : []),
          ],
        },
        {
          type: "section",
          id: "equipment-carrying",
          label: "WHILE EQUIPPED",
          children: [
            {
              type: "choice",
              id: "equipment-storage",
              label: "INVENTORY STORAGE",
              value: draft.equippedStorage,
              presentation: "segmented",
              onChange: (value) => setDraft((current) => ({ ...current, equippedStorage: value === "slot" ? "slot" : "inventory" })),
              options: [
                { value: "inventory", label: "also stays in inventory", help: "The equipped instance still occupies its inventory tile." },
                { value: "slot", label: "body slots only", help: "Equipping frees its inventory tile; unequipping needs free grid space." },
              ],
            },
          ],
        },
        {
          type: "section",
          id: "equipment-on-give",
          label: "AUTOMATIC EQUIP",
          children: [{
            type: "custom",
            id: "equipment-give-select",
            role: "specialized-control",
            content: <EquipOnGiveControl
              value={draft.equipOnGiveSlotKey}
              options={giveOptions}
              onChange={(equipOnGiveSlotKey) => setDraft((current) => ({ ...current, equipOnGiveSlotKey }))}
            />,
          }],
        },
      ],
      actions: [{
        id: "apply-equipment-policy",
        label: "APPLY TO ITEM",
        disabled: draft.mode === "placements" && draft.placements.length === 0,
        onAction: () => context.completeTask({
          type: "capability",
          capability: EQUIPMENT_POLICY_CAPABILITY,
          owner: "inventory",
          value: {
            placements: (draft.mode === "placements" ? normalizePlacements(draft.placements) : []).map((placement) => ({
              anchorSlotKey: placement.anchorSlotKey,
              occupiedSlotKeys: [...placement.occupiedSlotKeys],
            })),
            equippedStorage: draft.equippedStorage,
            equipOnGiveSlotKey: draft.equipOnGiveSlotKey,
          },
        }),
      }],
    };
  },
});

export const equipmentPlacementWorkspace = defineAuthorWorkspace<PlacementDraft>({
  id: "inventory-item-equipment-placement",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "item-equipment-placement",
  createDraft(route, context) {
    const parsed = safeParseObject(route.type === "feature" ? route.data?.placement : undefined);
    const extraKeys = [
      ...(typeof parsed?.anchorSlotKey === "string" ? [parsed.anchorSlotKey] : []),
      ...(Array.isArray(parsed?.occupiedSlotKeys) ? parsed.occupiedSlotKeys.filter((key): key is string => typeof key === "string") : []),
    ];
    return placementFromRoute(route.type === "feature" ? route.data?.placement : undefined, slotOptions(context.snapshot, extraKeys));
  },
  buildSpec({ route, context, draft, setDraft }): AuthorWorkspaceSpec {
    const options = slotOptions(context.snapshot, [draft.anchorSlotKey, ...draft.occupiedSlotKeys]);
    return {
      id: "inventory-item-equipment-placement",
      title: "EQUIPMENT PLACEMENT",
      context: route.type === "feature" ? route.data?.itemName : undefined,
      blocks: [
        {
          type: "section",
          id: "placement-anchor",
          label: "ANCHOR",
          importance: "primary",
          children: options.length ? [{
            type: "choice",
            id: "placement-anchor-choice",
            label: "EQUIP TO",
            value: draft.anchorSlotKey,
            presentation: "segmented",
            onChange: (anchorSlotKey) => setDraft((current) => {
              const onlyOldAnchor = current.occupiedSlotKeys.length === 1 && current.occupiedSlotKeys[0] === current.anchorSlotKey;
              return {
                anchorSlotKey,
                occupiedSlotKeys: onlyOldAnchor
                  ? [anchorSlotKey]
                  : uniqueKeys([anchorSlotKey, ...current.occupiedSlotKeys]),
              };
            }),
            options: options.map((option) => ({ value: option.key, label: option.label, help: option.detail })),
          }] : [{
            type: "status",
            id: "placement-no-body-slots",
            text: "Create body slots before defining an explicit equipment placement.",
            tone: "warning",
          }],
        },
        {
          type: "section",
          id: "placement-occupied-slots",
          label: "OCCUPIED SLOTS",
          summary: `${draft.occupiedSlotKeys.length} slot${draft.occupiedSlotKeys.length === 1 ? "" : "s"}`,
          children: [{
            type: "custom",
            id: "placement-occupied-control",
            role: "specialized-control",
            content: <OccupiedSlotsControl
              draft={draft}
              options={options}
              onChange={(occupiedSlotKeys) => setDraft((current) => ({
                ...current,
                occupiedSlotKeys: uniqueKeys([current.anchorSlotKey, ...occupiedSlotKeys]),
              }))}
            />,
          }],
        },
      ],
      actions: [{
        id: "apply-equipment-placement",
        label: "APPLY PLACEMENT",
        disabled: !draft.anchorSlotKey || !options.some((option) => option.key === draft.anchorSlotKey),
        onAction: () => {
          const placement = normalizedPlacement(draft);
          context.completeTask({
            type: "capability",
            capability: EQUIPMENT_PLACEMENT_CAPABILITY,
            owner: "inventory",
            value: {
              anchorSlotKey: placement.anchorSlotKey,
              occupiedSlotKeys: [...placement.occupiedSlotKeys],
            },
          });
        },
      }],
    };
  },
});

export const inventoryItemWorkspaces = [
  itemWorkspace,
  equipmentPolicyWorkspace,
  equipmentPlacementWorkspace,
] as const;
