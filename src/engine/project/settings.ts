import { DEFAULT_COMMANDS_PROJECT_SETTINGS, normalizeCommandsProjectSettings, type CommandsProjectSettingsSlice } from "../../features/commands/projectSettings";
import type { ProjectSnapshot } from "./model";

export type ProjectSettings = { terminalPrompt: string } & CommandsProjectSettingsSlice;
export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  terminalPrompt: "U:\\>",
  ...structuredClone(DEFAULT_COMMANDS_PROJECT_SETTINGS),
};

export function normalizeProjectSettings(value: unknown): ProjectSettings {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    terminalPrompt: typeof root.terminalPrompt === "string" && root.terminalPrompt.trim()
      ? root.terminalPrompt.slice(0, 32)
      : DEFAULT_PROJECT_SETTINGS.terminalPrompt,
    ...normalizeCommandsProjectSettings(root),
  };
}

function legacyDerivedSource(source: unknown) {
  switch (source) {
    case "commands_entered": return { provider: "commands", metric: "entered" };
    case "inventory_slots_used": return { provider: "inventory", metric: "occupied_cells" };
    case "visited_nodes": return { provider: "narrative", metric: "visited_nodes" };
    case "elapsed_seconds": default: return { provider: "session", metric: "elapsed_seconds" };
  }
}

function migrateLegacyEquipmentEffect(effect: any) {
  if (!effect || typeof effect !== "object" || effect.type !== "set_body_background") return effect;
  const { backgroundId, ...rest } = effect;
  return {
    ...rest,
    type: "set_body_type",
    bodyTypeId: typeof backgroundId === "string" ? backgroundId : "",
  };
}

function migrateHookEffects(hooks: unknown) {
  if (!Array.isArray(hooks)) return [];
  return hooks.map((hook) => hook && typeof hook === "object"
    ? { ...hook, effects: Array.isArray((hook as any).effects) ? (hook as any).effects.map(migrateLegacyEquipmentEffect) : [] }
    : hook);
}

function migrateInteractionEffects(interactions: unknown) {
  if (!Array.isArray(interactions)) return [];
  return interactions.map((interaction) => interaction && typeof interaction === "object"
    ? {
        ...interaction,
        outcomes: Array.isArray((interaction as any).outcomes)
          ? (interaction as any).outcomes.map((outcome: any) => outcome && typeof outcome === "object"
              ? { ...outcome, effects: Array.isArray(outcome.effects) ? outcome.effects.map(migrateLegacyEquipmentEffect) : [] }
              : outcome)
          : [],
      }
    : interaction);
}

/** One-way in-memory normalization for browser caches/bookmarks created before the current feature split. */
export function normalizeProjectSnapshot(snapshot: unknown): ProjectSnapshot {
  const root = snapshot && typeof snapshot === "object" ? snapshot as Record<string, any> : {};
  const legacyValues = Array.isArray(root.variables) ? root.variables : [];
  const legacyDerived = Array.isArray(root.computedValues) ? root.computedValues : [];

  const rawValues = Array.isArray(root.valueDefinitions)
    ? root.valueDefinitions
    : legacyValues.map(({ showInStatus: _show, ...definition }: any) => definition);
  const valueDefinitions = rawValues.map((definition: any) => ({
    ...definition,
    hooks: migrateHookEffects(definition.hooks),
  }));

  const rawDerived = Array.isArray(root.derivedValueDefinitions)
    ? root.derivedValueDefinitions
    : legacyDerived.map(({ showInStatus: _show, source, ...definition }: any) => ({
        ...definition,
        source: legacyDerivedSource(source),
      }));
  const derivedValueDefinitions = rawDerived.map((definition: any) => ({
    ...definition,
    hooks: migrateHookEffects(definition.hooks),
  }));

  const migratedVisible = [
    ...legacyValues.filter((item: any) => item.showInStatus).map((item: any, index: number) => ({
      id: `cached-status-value-${item.id}`,
      groupId: "cached-status",
      source: { kind: "value", id: item.id },
      label: item.label ?? "",
      order: index,
      visibleWhen: { type: "always" },
    })),
    ...legacyDerived.filter((item: any) => item.showInStatus).map((item: any, index: number) => ({
      id: `cached-status-derived-${item.id}`,
      groupId: "cached-status",
      source: { kind: "derived", id: item.id },
      label: item.label ?? "",
      order: legacyValues.length + index,
      visibleWhen: { type: "always" },
    })),
  ];
  const statusGroups = Array.isArray(root.statusGroups)
    ? root.statusGroups
    : migratedVisible.length
      ? [{ id: "cached-status", key: "status", label: "Status", order: 0, visibleWhen: { type: "always" } }]
      : [];
  const statusEntries = Array.isArray(root.statusEntries) ? root.statusEntries : migratedVisible;

  const legacyItems = Array.isArray(root.items) ? root.items : [];
  const items = legacyItems.map(({
    width: _width,
    height: _height,
    equipmentSlotKeys: _slotKeys,
    equippedStorage: _storage,
    equipOnGiveSlotKey: _auto,
    ...item
  }: any) => ({ ...item, hooks: migrateHookEffects(item.hooks) }));
  const itemInventoryLayouts = Array.isArray(root.itemInventoryLayouts)
    ? root.itemInventoryLayouts
    : legacyItems.map((item: any) => ({
        itemId: item.id,
        width: Math.max(1, Number(item.width) || 1),
        height: Math.max(1, Number(item.height) || 1),
      }));
  const inventoryPresentation = root.inventoryPresentation?.mode
    ? root.inventoryPresentation
    : legacyItems.length
      ? { mode: "grid", columns: 10, rows: 6 }
      : { mode: "list" };

  const bodyTypes = Array.isArray(root.bodyTypes)
    ? root.bodyTypes
    : Array.isArray(root.bodyBackgrounds)
      ? root.bodyBackgrounds.map((body: any) => ({
          id: body.id,
          name: body.name,
          assetId: body.assetId ?? "",
          slots: body.slots ?? [],
          startingEquipment: body.startingEquipment ?? [],
        }))
      : [];
  const equipmentRules = Array.isArray(root.equipmentRules)
    ? root.equipmentRules
    : legacyItems.map((item: any) => ({
        itemId: item.id,
        slotKeys: item.equipmentSlotKeys ?? [],
        storage: item.equippedStorage === "slot" ? "slot" : "inventory",
        equipOnGiveSlotKey: item.equipOnGiveSlotKey ?? null,
      }));

  const entities = (Array.isArray(root.entities) ? root.entities : []).map((entity: any) => ({
    ...entity,
    hooks: migrateHookEffects(entity.hooks),
  }));
  const interactions = migrateInteractionEffects(root.interactions);

  const next = {
    ...root,
    settings: normalizeProjectSettings(root.settings),
    interactions,
    entities,
    valueDefinitions,
    derivedValueDefinitions,
    statusGroups,
    statusEntries,
    items,
    inventoryPresentation,
    itemInventoryLayouts,
    bodyTypes,
    equipmentRules,
    startingBodyTypeId: root.startingBodyTypeId ?? root.startingBodyBackgroundId ?? null,
  };

  delete next.variables;
  delete next.computedValues;
  delete next.bodyBackgrounds;
  delete next.startingBodyBackgroundId;
  return next as ProjectSnapshot;
}
