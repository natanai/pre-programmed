import type { AuthorTaskResult } from "../../../author/tasks/types";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { AuthorWorkspaceSpec } from "../../../author/ui/types";
import type { ProjectSnapshot } from "../../../engine/project/model";
import type { EquipmentPlacementDefinition, ItemDefinition } from "../model";
import "./equipmentPlacement.css";

const EQUIPMENT_POLICY_CAPABILITY = "inventory.item-equipment-draft";
const EQUIPMENT_PLACEMENT_CAPABILITY = "inventory.item-equipment-placement-draft";

type SlotOption = { key: string; label: string; detail: string };
type EquipmentPolicyDraft = {
  mode: "any" | "placements";
  placements: EquipmentPlacementDefinition[];
  equippedStorage: "inventory" | "slot";
  equipOnGiveSlotKey: string | null;
};

type PlacementDraft = EquipmentPlacementDefinition;

function uniqueKeys(keys: readonly string[]) {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

export function normalizeEquipmentPlacements(placements: readonly EquipmentPlacementDefinition[]) {
  const byAnchor = new Map<string, EquipmentPlacementDefinition>();
  for (const raw of placements) {
    const anchorSlotKey = raw.anchorSlotKey.trim();
    if (!anchorSlotKey) continue;
    byAnchor.set(anchorSlotKey, {
      anchorSlotKey,
      occupiedSlotKeys: uniqueKeys([anchorSlotKey, ...(raw.occupiedSlotKeys ?? [])]),
    });
  }
  return [...byAnchor.values()];
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
  return [...slots.entries()].map(([key, value]) => ({
    key,
    label: [...value.labels].join(" / ") || key,
    detail: value.bodies.size ? [...value.bodies].join(", ") : "missing from current body types",
  })).sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key));
}

function slotLabel(options: readonly SlotOption[], key: string) {
  return options.find((option) => option.key === key)?.label ?? key;
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
  return normalizeEquipmentPlacements(value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const record = candidate as Record<string, unknown>;
    if (typeof record.anchorSlotKey !== "string" || !Array.isArray(record.occupiedSlotKeys)) return [];
    if (!record.occupiedSlotKeys.every((key) => typeof key === "string")) return [];
    return [{ anchorSlotKey: record.anchorSlotKey, occupiedSlotKeys: record.occupiedSlotKeys as string[] }];
  }));
}

function policyFromRoute(raw: string | undefined): EquipmentPolicyDraft {
  const parsed = safeParseObject(raw);
  const placements = parsePlacements(parsed?.placements);
  return {
    mode: placements.length ? "placements" : "any",
    placements,
    equippedStorage: parsed?.equippedStorage === "slot" ? "slot" : "inventory",
    equipOnGiveSlotKey: typeof parsed?.equipOnGiveSlotKey === "string" ? parsed.equipOnGiveSlotKey : null,
  };
}

function placementFromRoute(raw: string | undefined, options: readonly SlotOption[]): PlacementDraft {
  const parsed = safeParseObject(raw);
  const anchorSlotKey = typeof parsed?.anchorSlotKey === "string" ? parsed.anchorSlotKey : options[0]?.key ?? "";
  const occupied = Array.isArray(parsed?.occupiedSlotKeys) && parsed.occupiedSlotKeys.every((key) => typeof key === "string")
    ? parsed.occupiedSlotKeys as string[]
    : [];
  return { anchorSlotKey, occupiedSlotKeys: uniqueKeys([anchorSlotKey, ...occupied]) };
}

function capabilityValue(result: AuthorTaskResult | undefined, capability: string) {
  return result?.type === "capability" && result.owner === "inventory" && result.capability === capability
    ? result.value
    : undefined;
}

export function equipmentPolicyFromResult(result: AuthorTaskResult | undefined) {
  const value = capabilityValue(result, EQUIPMENT_POLICY_CAPABILITY);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const equippedStorage = record.equippedStorage === "slot" ? "slot" : record.equippedStorage === "inventory" ? "inventory" : null;
  if (!equippedStorage) return null;
  return {
    equipmentPlacements: parsePlacements(record.placements),
    equippedStorage,
    equipOnGiveSlotKey: typeof record.equipOnGiveSlotKey === "string" ? record.equipOnGiveSlotKey : null,
  };
}

function placementFromResult(result: AuthorTaskResult | undefined) {
  const value = capabilityValue(result, EQUIPMENT_PLACEMENT_CAPABILITY);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.anchorSlotKey !== "string" || !Array.isArray(record.occupiedSlotKeys)) return null;
  if (!record.occupiedSlotKeys.every((key) => typeof key === "string")) return null;
  return normalizeEquipmentPlacements([{ anchorSlotKey: record.anchorSlotKey, occupiedSlotKeys: record.occupiedSlotKeys as string[] }])[0] ?? null;
}

export function equipmentSummary(item: ItemDefinition, snapshot: ProjectSnapshot) {
  const placements = normalizeEquipmentPlacements(item.equipmentPlacements ?? []);
  if (!placements.length) return "Any body slot · occupies chosen slot only";
  const options = slotOptions(snapshot, placements.flatMap((placement) => placement.occupiedSlotKeys));
  const maxSlots = Math.max(...placements.map((placement) => placement.occupiedSlotKeys.length));
  const anchors = placements.slice(0, 2).map((placement) => slotLabel(options, placement.anchorSlotKey));
  return `${anchors.join(" / ")}${placements.length > 2 ? ` +${placements.length - 2}` : ""} · up to ${maxSlots} occupied slot${maxSlots === 1 ? "" : "s"}`;
}

export function equipmentPolicyRoute(item: ItemDefinition) {
  return {
    type: "feature" as const,
    feature: "inventory",
    workspace: "item-equipment",
    data: {
      itemName: item.name || "Item",
      policy: JSON.stringify({
        placements: item.equipmentPlacements ?? [],
        equippedStorage: item.equippedStorage ?? "inventory",
        equipOnGiveSlotKey: item.equipOnGiveSlotKey ?? null,
      }),
    },
  };
}

function PlacementList({ placements, options, onAdd, onEdit, onRemove }: {
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

function OccupiedSlotsControl({ draft, options, onChange }: {
  draft: PlacementDraft;
  options: SlotOption[];
  onChange: (occupiedSlotKeys: string[]) => void;
}) {
  return <div className="equipment-occupied-control">
    <p className="field-help">The anchor is always occupied. Select every additional body slot reserved by this placement.</p>
    <div className="equipment-slot-grid">
      {options.map((option) => {
        const anchor = option.key === draft.anchorSlotKey;
        const checked = anchor || draft.occupiedSlotKeys.includes(option.key);
        return <label className="check-label" key={option.key}>
          <input type="checkbox" checked={checked} disabled={anchor} onChange={(event) => onChange(event.target.checked
            ? uniqueKeys([...draft.occupiedSlotKeys, option.key])
            : draft.occupiedSlotKeys.filter((key) => key !== option.key))} />
          <span>{option.label}</span><small>{anchor ? "anchor" : option.key}</small>
        </label>;
      })}
    </div>
  </div>;
}

export const equipmentPolicyWorkspace = defineAuthorWorkspace<EquipmentPolicyDraft>({
  id: "inventory-item-equipment",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "item-equipment",
  createDraft: (route) => policyFromRoute(route.data?.policy),
  buildSpec({ route, context, draft, setDraft }): AuthorWorkspaceSpec {
    const options = slotOptions(context.snapshot, draft.placements.flatMap((placement) => placement.occupiedSlotKeys));
    const anchors = new Set(draft.placements.map((placement) => placement.anchorSlotKey));
    const giveOptions = draft.mode === "placements" ? options.filter((option) => anchors.has(option.key)) : options;

    const openPlacement = (placement?: EquipmentPlacementDefinition) => context.pushTask({
      type: "feature",
      feature: "inventory",
      workspace: "item-equipment-placement",
      data: {
        itemName: route.data?.itemName ?? "Item",
        ...(placement ? { placement: JSON.stringify(placement) } : {}),
      },
    }, (result) => {
      const next = placementFromResult(result);
      if (!next) return;
      setDraft((current) => ({
        ...current,
        mode: "placements",
        placements: normalizeEquipmentPlacements([
          ...current.placements.filter((candidate) => candidate.anchorSlotKey !== placement?.anchorSlotKey && candidate.anchorSlotKey !== next.anchorSlotKey),
          next,
        ]),
      }));
    });

    return {
      id: "inventory-item-equipment",
      title: "Equipment",
      context: route.data?.itemName,
      blocks: [
        {
          type: "section", id: "equipment-fit", label: "Fit", importance: "primary", children: [
            { type: "choice", id: "equipment-fit-mode", label: "Placements", value: draft.mode, presentation: "segmented", onChange: (mode) => setDraft((current) => ({
              ...current,
              mode: mode === "placements" ? "placements" : "any",
              equipOnGiveSlotKey: mode === "placements" && current.equipOnGiveSlotKey
                && !current.placements.some((placement) => placement.anchorSlotKey === current.equipOnGiveSlotKey)
                ? null : current.equipOnGiveSlotKey,
            })), options: [
              { value: "any", label: "ANY SINGLE SLOT", help: "May anchor in any body slot and occupies only that slot." },
              { value: "placements", label: "DEFINED PLACEMENTS", help: "Choose exact anchors and every slot each placement occupies." },
            ] },
            ...(draft.mode === "placements" ? [{ type: "custom" as const, id: "equipment-placement-list", role: "ordered-list" as const, content: <PlacementList
              placements={draft.placements} options={options} onAdd={() => openPlacement()} onEdit={openPlacement}
              onRemove={(anchorSlotKey) => setDraft((current) => ({
                ...current,
                placements: current.placements.filter((placement) => placement.anchorSlotKey !== anchorSlotKey),
                equipOnGiveSlotKey: current.equipOnGiveSlotKey === anchorSlotKey ? null : current.equipOnGiveSlotKey,
              }))}
            /> }] : []),
            ...(!options.length ? [{ type: "status" as const, id: "equipment-no-slots", tone: "info" as const, text: "No body slots exist yet. Any-single-slot mode remains future-compatible; explicit placements can be added after slots are authored." }] : []),
          ],
        },
        { type: "section", id: "equipment-storage", label: "While equipped", children: [
          { type: "choice", id: "equipment-storage-choice", label: "Inventory storage", value: draft.equippedStorage, presentation: "segmented", onChange: (value) => setDraft((current) => ({ ...current, equippedStorage: value === "slot" ? "slot" : "inventory" })), options: [
            { value: "inventory", label: "STAYS IN INVENTORY" },
            { value: "slot", label: "BODY SLOTS ONLY", help: "Equipping frees its inventory tile; unequipping needs free grid space." },
          ] },
        ] },
        { type: "section", id: "equipment-auto", label: "Automatic equip", children: [
          { type: "select", id: "equipment-equip-on-give", label: "When given to player", value: draft.equipOnGiveSlotKey ?? "", onChange: (value) => setDraft((current) => ({ ...current, equipOnGiveSlotKey: value || null })), options: [
            { value: "", label: "keep in general inventory" },
            ...giveOptions.map((option) => ({ value: option.key, label: `equip to ${option.label}` })),
          ], help: "Starting equipment is configured on each body type." },
        ] },
      ],
      actions: [{
        id: "equipment-apply",
        label: "APPLY TO ITEM",
        disabled: draft.mode === "placements" && !draft.placements.length,
        onAction: () => context.completeTask({
          type: "capability", owner: "inventory", capability: EQUIPMENT_POLICY_CAPABILITY,
          value: {
            placements: draft.mode === "placements" ? normalizeEquipmentPlacements(draft.placements) : [],
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
    const parsed = safeParseObject(route.data?.placement);
    const extraKeys = [
      ...(typeof parsed?.anchorSlotKey === "string" ? [parsed.anchorSlotKey] : []),
      ...(Array.isArray(parsed?.occupiedSlotKeys) ? parsed.occupiedSlotKeys.filter((key): key is string => typeof key === "string") : []),
    ];
    return placementFromRoute(route.data?.placement, slotOptions(context.snapshot, extraKeys));
  },
  buildSpec({ route, context, draft, setDraft }): AuthorWorkspaceSpec {
    const options = slotOptions(context.snapshot, [draft.anchorSlotKey, ...draft.occupiedSlotKeys]);
    return {
      id: "inventory-item-equipment-placement",
      title: "Equipment placement",
      context: route.data?.itemName,
      blocks: [
        { type: "section", id: "placement-anchor", label: "Anchor", importance: "primary", children: options.length ? [
          { type: "choice", id: "placement-anchor-choice", label: "Equip to", value: draft.anchorSlotKey, presentation: "segmented", onChange: (anchorSlotKey) => setDraft((current) => ({
            anchorSlotKey,
            occupiedSlotKeys: current.occupiedSlotKeys.length === 1 && current.occupiedSlotKeys[0] === current.anchorSlotKey
              ? [anchorSlotKey] : uniqueKeys([anchorSlotKey, ...current.occupiedSlotKeys]),
          })), options: options.map((option) => ({ value: option.key, label: option.label, help: option.detail })) },
        ] : [{ type: "status", id: "placement-no-slots", tone: "warning", text: "Create body slots before defining an explicit equipment placement." }] },
        { type: "section", id: "placement-occupied", label: "Occupied slots", summary: `${draft.occupiedSlotKeys.length} slot${draft.occupiedSlotKeys.length === 1 ? "" : "s"}`, children: [
          { type: "custom", id: "placement-occupied-control", role: "specialized-control", content: <OccupiedSlotsControl draft={draft} options={options} onChange={(occupiedSlotKeys) => setDraft((current) => ({ ...current, occupiedSlotKeys: uniqueKeys([current.anchorSlotKey, ...occupiedSlotKeys]) }))} /> },
        ] },
      ],
      actions: [{
        id: "placement-apply", label: "APPLY PLACEMENT",
        disabled: !draft.anchorSlotKey || !options.some((option) => option.key === draft.anchorSlotKey),
        onAction: () => {
          const placement = normalizeEquipmentPlacements([draft])[0];
          if (!placement) return;
          context.completeTask({ type: "capability", owner: "inventory", capability: EQUIPMENT_PLACEMENT_CAPABILITY, value: placement });
        },
      }],
    };
  },
});

export const INVENTORY_EQUIPMENT_WORKSPACES = [equipmentPolicyWorkspace, equipmentPlacementWorkspace] as const;
