import type { CommandReferenceSource } from "../commands/referenceSource";

export const INVENTORY_COMMAND_REFERENCE_SOURCES: readonly CommandReferenceSource[] = [
  {
    kind: "inventory.item",
    label: "INVENTORY ITEMS",
    description: "Let command patterns refer to items currently carried by the player.",
    candidates: (snapshot, state) => state.inventory.flatMap((entry) => {
      const definition = snapshot.items.find((item) => item.id === entry.itemId);
      if (!definition) return [];
      return [{
        id: entry.instanceId,
        label: definition.name,
        aliases: [definition.name, definition.key, ...definition.tags],
        target: { kind: "item", id: entry.instanceId },
      }];
    }),
  },
];
