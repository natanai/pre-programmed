import type { DerivedValueProvider } from "../../engine/values/derivedValue";

export const INVENTORY_DERIVED_VALUE_PROVIDER: DerivedValueProvider = {
  id: "inventory",
  label: "Inventory",
  metrics: [{ id: "occupied_cells", label: "Occupied inventory cells" }],
  read(metric, snapshot, state) {
    if (metric !== "occupied_cells") return undefined;
    if (snapshot.inventoryPresentation.mode !== "grid") return 0;
    const layouts = new Map(snapshot.itemInventoryLayouts.map((layout) => [layout.itemId, layout]));
    return state.inventory.reduce((total, entry) => {
      if (!state.inventoryPositions[entry.instanceId]) return total;
      const layout = layouts.get(entry.itemId) ?? { width: 1, height: 1 };
      return total + layout.width * layout.height;
    }, 0);
  },
};
