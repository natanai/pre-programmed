import { ReferenceField } from "../../../author/resources/ReferenceField";
import { referencesTo } from "../../../author/references/projectReferences";
import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { MutationOperation, ProjectSnapshot } from "../../../engine/project/model";
import {
  DEFAULT_BODY_CANVAS,
  normalizeBodyTypeDefinition,
  resizeBodyCanvas,
  slotFitsBodyCanvas,
} from "../bodyCanvas";
import type { BodyBackgroundDefinition, BodyCanvasDefinition, BodySlotDefinition } from "../model";
import { setActiveBodyType } from "../runtime";
import { BodyTypeLayoutControl } from "./BodyTypeLayoutControl";
import { inventoryRoute } from "./workspaces";
import "./inventoryWorkspaces.css";

type BodyTypeDraft = {
  bodyType: BodyBackgroundDefinition;
  starting: boolean;
};

type BodySlotTaskDraft = {
  ownerId: string;
  canvas: BodyCanvasDefinition;
  slot: BodySlotDefinition;
  reservedKeys: string[];
  startingItemId: string;
  isNew: boolean;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function emptyBodyType(): BodyBackgroundDefinition {
  return {
    id: crypto.randomUUID(),
    name: "",
    assetId: "",
    canvas: { ...DEFAULT_BODY_CANVAS },
    slots: [],
    startingEquipment: [],
  };
}

function bodyTypeValid(snapshot: ProjectSnapshot, bodyType: BodyBackgroundDefinition) {
  const keys = (bodyType.slots ?? []).map((slot) => slot.key.trim());
  const slotKeysValid = keys.every(Boolean) && new Set(keys).size === keys.length;
  const slotsFitCanvas = (bodyType.slots ?? []).every((slot) => slotFitsBodyCanvas(slot, bodyType.canvas));
  const counts = new Map<string, number>();
  for (const assignment of bodyType.startingEquipment ?? []) counts.set(assignment.itemId, (counts.get(assignment.itemId) ?? 0) + 1);
  const startingEquipmentValid = [...counts].every(([itemId, count]) => count <= (snapshot.items.find((item) => item.id === itemId)?.startingQuantity ?? 0));
  return { slotKeysValid, slotsFitCanvas, startingEquipmentValid };
}

function newSlot(bodyType: BodyBackgroundDefinition) {
  const count = (bodyType.slots ?? []).length + 1;
  const width = Math.max(1, bodyType.canvas.width * .2);
  const height = Math.max(1, bodyType.canvas.height * .12);
  return {
    id: crypto.randomUUID(),
    key: `slot_${count}`,
    name: "",
    x: (bodyType.canvas.width - width) / 2,
    y: (bodyType.canvas.height - height) / 2,
    width,
    height,
  } satisfies BodySlotDefinition;
}

function bodySlotRoute(bodyType: BodyBackgroundDefinition, slot?: BodySlotDefinition) {
  const nextSlot = slot ?? newSlot(bodyType);
  const startingItemId = (bodyType.startingEquipment ?? []).find((assignment) => assignment.slotKey === nextSlot.key)?.itemId ?? "";
  const payload: BodySlotTaskDraft = {
    ownerId: bodyType.id,
    canvas: bodyType.canvas,
    slot: nextSlot,
    reservedKeys: (bodyType.slots ?? []).filter((candidate) => candidate.id !== nextSlot.id).map((candidate) => candidate.key),
    startingItemId,
    isNew: !slot,
  };
  return {
    type: "feature" as const,
    feature: "inventory",
    workspace: "body-slot",
    data: { slotDraft: JSON.stringify(payload), slotName: nextSlot.name || nextSlot.key },
  };
}

function readSlotTask(routeData: Record<string, string> | undefined): BodySlotTaskDraft {
  try {
    const value = JSON.parse(routeData?.slotDraft ?? "") as Partial<BodySlotTaskDraft>;
    if (value.ownerId && value.canvas && value.slot) {
      return {
        ownerId: value.ownerId,
        canvas: value.canvas,
        slot: value.slot,
        reservedKeys: Array.isArray(value.reservedKeys) ? value.reservedKeys.filter((key): key is string => typeof key === "string") : [],
        startingItemId: value.startingItemId ?? "",
        isNew: Boolean(value.isNew),
      };
    }
  } catch {
    // A malformed route cannot be authored; return a clearly invalid fallback draft.
  }
  return {
    ownerId: "",
    canvas: { ...DEFAULT_BODY_CANVAS },
    slot: { id: crypto.randomUUID(), key: "", name: "", x: 0, y: 0, width: 1, height: 1 },
    reservedKeys: [],
    startingItemId: "",
    isNew: true,
  };
}

function resultObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export const inventoryBodyTypesWorkspace = defineAuthorWorkspace({
  id: "inventory-body-types",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "body-types",
  createDraft: () => ({}),
  buildSpec: ({ context }) => ({
    id: "inventory-body-types",
    title: "Body types",
    context: `${(context.snapshot.bodyBackgrounds ?? []).length} body type${(context.snapshot.bodyBackgrounds ?? []).length === 1 ? "" : "s"}`,
    blocks: [{
      type: "custom",
      id: "inventory-body-types-list",
      role: "results",
      content: <div className="inventory-author-resource-list">
        <button type="button" onClick={() => context.pushTask(inventoryRoute("body-type"))}>[+ BODY TYPE]</button>
        {(context.snapshot.bodyBackgrounds ?? []).map((rawBodyType) => {
          const bodyType = normalizeBodyTypeDefinition(rawBodyType);
          return <div className="inventory-author-resource-row" key={bodyType.id}>
            <button type="button" className="inventory-author-resource-open" onClick={() => context.pushTask(inventoryRoute("body-type", bodyType.id))}>
              <span>{bodyType.name || "Untitled body type"}</span>
              <small>{bodyType.id === context.snapshot.startingBodyBackgroundId ? "starting · " : ""}{bodyType.canvas.width}×{bodyType.canvas.height} · {(bodyType.slots ?? []).length} slots</small>
            </button>
            <div className="inventory-author-resource-actions">
              <button type="button" onClick={() => context.runtime.updateState(setActiveBodyType(context.snapshot, context.playState, bodyType.id))}>[USE THIS RUN]</button>
            </div>
          </div>;
        })}
      </div>,
    }],
  }),
});

export const inventoryBodyTypeWorkspace = defineAuthorWorkspace<BodyTypeDraft>({
  id: "inventory-body-type",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "body-type",
  createDraft: (route, context) => {
    const initial = route.data?.bodyTypeId ? (context.snapshot.bodyBackgrounds ?? []).find((candidate) => candidate.id === route.data?.bodyTypeId) : undefined;
    const bodyType = normalizeBodyTypeDefinition(structuredClone(initial ?? emptyBodyType()));
    return {
      bodyType,
      starting: initial
        ? context.snapshot.startingBodyBackgroundId === initial.id
        : !context.snapshot.startingBodyBackgroundId && (context.snapshot.bodyBackgrounds ?? []).length === 0,
    };
  },
  buildSpec: ({ context, draft, setDraft }) => {
    const existing = (context.snapshot.bodyBackgrounds ?? []).some((candidate) => candidate.id === draft.bodyType.id);
    const usages = existing ? referencesTo(context.snapshot, "body-type", draft.bodyType.id) : [];
    const validity = bodyTypeValid(context.snapshot, draft.bodyType);
    const updateCanvasSize = (axis: "width" | "height", rawValue: string) => {
      const value = Math.max(1, Math.round(Number(rawValue) || 1));
      setDraft((current) => {
        const width = axis === "width" ? value : current.bodyType.canvas.width;
        const height = axis === "height" ? value : current.bodyType.canvas.height;
        return { ...current, bodyType: resizeBodyCanvas(current.bodyType, width, height) };
      });
    };
    const openSlot = (slot?: BodySlotDefinition) => context.pushTask(bodySlotRoute(draft.bodyType, slot), (result) => {
      if (result?.type !== "capability" || result.capability !== "inventory.body-slot" || result.owner !== draft.bodyType.id) return;
      const value = resultObject(result.value);
      if (!value || typeof value.action !== "string" || typeof value.slotId !== "string") return;
      setDraft((current) => {
        const previous = (current.bodyType.slots ?? []).find((candidate) => candidate.id === value.slotId);
        if (value.action === "remove") {
          if (!previous) return current;
          return {
            ...current,
            bodyType: {
              ...current.bodyType,
              slots: (current.bodyType.slots ?? []).filter((candidate) => candidate.id !== previous.id),
              startingEquipment: (current.bodyType.startingEquipment ?? []).filter((assignment) => assignment.slotKey !== previous.key),
            },
          };
        }
        if (value.action !== "save"
          || typeof value.key !== "string"
          || typeof value.name !== "string"
          || typeof value.x !== "number"
          || typeof value.y !== "number"
          || typeof value.width !== "number"
          || typeof value.height !== "number"
          || typeof value.startingItemId !== "string") return current;
        const nextSlot: BodySlotDefinition = {
          id: value.slotId,
          key: value.key,
          name: value.name,
          x: value.x,
          y: value.y,
          width: value.width,
          height: value.height,
        };
        const oldKey = previous?.key ?? nextSlot.key;
        return {
          ...current,
          bodyType: {
            ...current.bodyType,
            slots: previous
              ? (current.bodyType.slots ?? []).map((candidate) => candidate.id === nextSlot.id ? nextSlot : candidate)
              : [...(current.bodyType.slots ?? []), nextSlot],
            startingEquipment: [
              ...(current.bodyType.startingEquipment ?? []).filter((assignment) => assignment.slotKey !== oldKey && assignment.slotKey !== nextSlot.key),
              ...(value.startingItemId ? [{ slotKey: nextSlot.key, itemId: value.startingItemId }] : []),
            ],
          },
        };
      });
    });

    return {
      id: "inventory-body-type",
      title: draft.bodyType.name || "New body type",
      context: `${draft.bodyType.canvas.width}×${draft.bodyType.canvas.height} · ${(draft.bodyType.slots ?? []).length} slot${(draft.bodyType.slots ?? []).length === 1 ? "" : "s"}`,
      blocks: [
        {
          type: "section",
          id: "inventory-body-type-identity",
          label: "Body type",
          importance: "primary",
          children: [
            { type: "field", id: "inventory-body-type-name", label: "Name", value: draft.bodyType.name, autoFocus: !existing, help: "Age, form, species, armor layout, transformation, vehicle chassis, or any other equipment configuration.", onChange: (name) => setDraft((current) => ({ ...current, bodyType: { ...current.bodyType, name } })) },
            { type: "toggle", id: "inventory-body-type-starting", label: "Start new playthroughs with this body type", checked: draft.starting, onChange: (starting) => setDraft((current) => ({ ...current, starting })) },
          ],
        },
        {
          type: "section",
          id: "inventory-body-type-canvas",
          label: "Canvas + background",
          children: [
            { type: "field", id: "inventory-body-type-canvas-width", label: "Canvas width", control: "number", value: draft.bodyType.canvas.width, help: "Logical layout units, not image pixels. Changing the size rescales existing slot positions proportionally.", onChange: (value) => updateCanvasSize("width", value) },
            { type: "field", id: "inventory-body-type-canvas-height", label: "Canvas height", control: "number", value: draft.bodyType.canvas.height, onChange: (value) => updateCanvasSize("height", value) },
            { type: "choice", id: "inventory-body-type-fit", label: "Background fit", value: draft.bodyType.canvas.fit, presentation: "segmented", onChange: (fit) => setDraft((current) => ({ ...current, bodyType: { ...current.bodyType, canvas: { ...current.bodyType.canvas, fit: fit === "cover" ? "cover" : "contain" } } })), options: [
              { value: "contain", label: "CONTAIN", help: "Show the whole image; unused canvas space may remain." },
              { value: "cover", label: "COVER", help: "Fill the canvas; image edges may be cropped." },
            ] },
            { type: "custom", id: "inventory-body-type-image", role: "resource-picker", content: <ReferenceField kind="media-image" value={draft.bodyType.assetId} onChange={(assetId) => setDraft((current) => ({ ...current, bodyType: { ...current.bodyType, assetId } }))} placeholder="none" /> },
            { type: "status", id: "inventory-body-type-image-help", tone: "info", text: `Any Media image can be used. Creating an image here offers file upload or the scalable Vector maker. The ${DEFAULT_BODY_CANVAS.width}×${DEFAULT_BODY_CANVAS.height} Portrait vector preset matches the default Body canvas, but neither asset resolution nor Body shape is restricted to that size.` },
          ],
        },
        {
          type: "custom",
          id: "inventory-body-type-layout",
          role: "specialized-control",
          content: <BodyTypeLayoutControl
            snapshot={context.snapshot}
            draft={draft.bodyType}
            onChange={(bodyType) => setDraft((current) => ({ ...current, bodyType }))}
            onAddSlot={() => openSlot()}
            onEditSlot={(slot) => openSlot(slot)}
          />,
        },
        ...(!validity.slotKeysValid ? [{ type: "status" as const, id: "inventory-body-type-slot-error", tone: "error" as const, text: "Each body slot needs a unique, non-empty slot key." }] : []),
        ...(!validity.slotsFitCanvas ? [{ type: "status" as const, id: "inventory-body-type-bounds-error", tone: "error" as const, text: "Every slot must remain within this Body Type's logical canvas." }] : []),
        ...(!validity.startingEquipmentValid ? [{ type: "status" as const, id: "inventory-body-type-equipment-error", tone: "error" as const, text: "Starting equipment exceeds an item’s starting quantity. Increase the item quantity or clear a slot." }] : []),
      ],
      actions: existing ? [{
        id: "inventory-body-type-delete",
        label: `DELETE${usages.length ? ` · ${usages.length} USE${usages.length === 1 ? "" : "S"}` : ""}`,
        tone: "danger",
        disabled: usages.length > 0,
        onAction: () => {
          if (usages.length || !window.confirm(`Delete body type “${draft.bodyType.name}”?`)) return;
          void context.persist([{ type: "bodyBackground.delete", id: draft.bodyType.id }], `Delete body type ${draft.bodyType.name}`).then((result) => {
            if ((result.status === "saved" || result.status === "queued") && context.hasParentTask) context.leaveCurrentTask();
          });
        },
      }] : [],
    };
  },
  async save({ route, context, draft }) {
    const name = draft.bodyType.name.trim();
    const validity = bodyTypeValid(context.snapshot, draft.bodyType);
    if (!name || !validity.slotKeysValid || !validity.slotsFitCanvas || !validity.startingEquipmentValid) return { accepted: false };
    const bodyType = normalizeBodyTypeDefinition({
      ...draft.bodyType,
      name,
      slots: (draft.bodyType.slots ?? []).map((slot) => ({ ...slot, key: slot.key.trim(), name: slot.name.trim() || slot.key.trim() })),
      startingEquipment: (draft.bodyType.startingEquipment ?? [])
        .filter((assignment) => (draft.bodyType.slots ?? []).some((slot) => slot.key.trim() === assignment.slotKey.trim()))
        .map((assignment) => ({ ...assignment, slotKey: assignment.slotKey.trim() })),
    });
    const operations: MutationOperation[] = [{ type: "bodyBackground.upsert", background: bodyType }];
    if (draft.starting && context.snapshot.startingBodyBackgroundId !== bodyType.id) operations.push({ type: "bodyBackground.starting", id: bodyType.id });
    else if (!draft.starting && context.snapshot.startingBodyBackgroundId === bodyType.id) operations.push({ type: "bodyBackground.starting", id: null });
    const result = await context.persist(operations, `${(context.snapshot.bodyBackgrounds ?? []).some((candidate) => candidate.id === bodyType.id) ? "Change" : "Create"} body type ${bodyType.name}`);
    if (result.status !== "saved" && result.status !== "queued") return { accepted: false };
    const savedDraft = { ...draft, bodyType };
    return {
      accepted: true,
      draft: savedDraft,
      ...(route.data?.resourceTask ? { completion: { type: "resource" as const, kind: "body-type", id: bodyType.id, value: bodyType.id, label: bodyType.name } } : {}),
    };
  },
});

export const inventoryBodySlotWorkspace = defineAuthorWorkspace<BodySlotTaskDraft>({
  id: "inventory-body-slot",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "body-slot",
  createDraft: (route) => readSlotTask(route.data),
  buildSpec: ({ context, draft, setDraft }) => {
    const slot = draft.slot;
    const maxX = Math.max(0, draft.canvas.width - slot.width);
    const maxY = Math.max(0, draft.canvas.height - slot.height);
    const compatibleItems = context.snapshot.items.filter((item) =>
      (item.startingQuantity ?? 0) > 0
      && (!(item.equipmentSlotKeys ?? []).length || (item.equipmentSlotKeys ?? []).includes(slot.key)),
    );
    const uniqueKey = Boolean(slot.key.trim() && !draft.reservedKeys.includes(slot.key.trim()));
    const slotValid = Boolean(uniqueKey && slot.name.trim() && slotFitsBodyCanvas(slot, draft.canvas));
    return {
      id: "inventory-body-slot",
      title: slot.name || (draft.isNew ? "New body slot" : slot.key || "Body slot"),
      context: `${draft.canvas.width}×${draft.canvas.height} body canvas`,
      blocks: [
        {
          type: "section",
          id: "inventory-body-slot-identity",
          label: "Slot",
          importance: "primary",
          children: [
            { type: "field", id: "inventory-body-slot-name", label: "Name", value: slot.name, autoFocus: draft.isNew, onChange: (name) => setDraft((current) => ({ ...current, slot: { ...current.slot, name } })) },
            { type: "field", id: "inventory-body-slot-key", label: "Slot key", value: slot.key, help: "Reuse the same key on another Body Type when equipment should stay equipped across that change.", onChange: (key) => setDraft((current) => {
              const nextKey = key.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
              const startingItem = context.snapshot.items.find((item) => item.id === current.startingItemId);
              const staysCompatible = !startingItem
                || !(startingItem.equipmentSlotKeys ?? []).length
                || (startingItem.equipmentSlotKeys ?? []).includes(nextKey);
              return {
                ...current,
                slot: { ...current.slot, key: nextKey },
                startingItemId: staysCompatible ? current.startingItemId : "",
              };
            }) },
          ],
        },
        {
          type: "section",
          id: "inventory-body-slot-geometry",
          label: "Geometry",
          children: [
            { type: "field", id: "inventory-body-slot-x", label: "X", control: "number", value: Number(slot.x.toFixed(2)), onChange: (value) => setDraft((current) => ({ ...current, slot: { ...current.slot, x: clamp(Number(value) || 0, 0, maxX) } })) },
            { type: "field", id: "inventory-body-slot-y", label: "Y", control: "number", value: Number(slot.y.toFixed(2)), onChange: (value) => setDraft((current) => ({ ...current, slot: { ...current.slot, y: clamp(Number(value) || 0, 0, maxY) } })) },
            { type: "field", id: "inventory-body-slot-width", label: "Width", control: "number", value: Number(slot.width.toFixed(2)), onChange: (value) => setDraft((current) => ({ ...current, slot: { ...current.slot, width: clamp(Number(value) || 1, Math.min(1, current.canvas.width), current.canvas.width - current.slot.x) } })) },
            { type: "field", id: "inventory-body-slot-height", label: "Height", control: "number", value: Number(slot.height.toFixed(2)), onChange: (value) => setDraft((current) => ({ ...current, slot: { ...current.slot, height: clamp(Number(value) || 1, Math.min(1, current.canvas.height), current.canvas.height - current.slot.y) } })) },
          ],
        },
        {
          type: "select",
          id: "inventory-body-slot-starting-item",
          label: "Starting equipment",
          value: draft.startingItemId,
          help: "Uses one instance from the item's starting quantity in each new playthrough.",
          onChange: (startingItemId) => setDraft((current) => ({ ...current, startingItemId })),
          options: [
            { value: "", label: "empty" },
            ...compatibleItems.map((item) => ({ value: item.id, label: `${item.name} · ${item.startingQuantity} starting` })),
          ],
        },
        ...(!uniqueKey ? [{ type: "status" as const, id: "inventory-body-slot-key-error", tone: "error" as const, text: "Use a unique, non-empty slot key within this Body Type." }] : []),
        ...(!slotValid && uniqueKey ? [{ type: "status" as const, id: "inventory-body-slot-error", tone: "error" as const, text: "Give the slot a name and keep its geometry inside the Body canvas." }] : []),
      ],
      actions: !draft.isNew ? [{
        id: "inventory-body-slot-remove",
        label: "REMOVE SLOT",
        tone: "danger",
        onAction: () => context.completeTask({
          type: "capability",
          capability: "inventory.body-slot",
          owner: draft.ownerId,
          value: { action: "remove", slotId: slot.id },
        }),
      }] : [],
    };
  },
  async save({ draft }) {
    const slot = {
      ...draft.slot,
      key: draft.slot.key.trim(),
      name: draft.slot.name.trim(),
    };
    if (!draft.ownerId || !slot.key || draft.reservedKeys.includes(slot.key) || !slot.name || !slotFitsBodyCanvas(slot, draft.canvas)) return { accepted: false };
    return {
      accepted: true,
      draft: { ...draft, slot },
      completion: {
        type: "capability",
        capability: "inventory.body-slot",
        owner: draft.ownerId,
        value: {
          action: "save",
          slotId: slot.id,
          key: slot.key,
          name: slot.name,
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
          startingItemId: draft.startingItemId,
        },
      },
    };
  },
});

export const BODY_WORKSPACES = [
  inventoryBodyTypesWorkspace,
  inventoryBodyTypeWorkspace,
  inventoryBodySlotWorkspace,
] as const;
