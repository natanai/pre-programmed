import type { CommandReferenceSource } from "../commands/referenceSource";

export const INVENTORY_COMMAND_REFERENCE_SOURCES: readonly CommandReferenceSource[] = [
  {
    kind: "inventory.item",
    label: "INVENTORY ITEMS",
    description: "Let command patterns refer to items currently carried by the player.",
    authorResourceKind: "item",
    candidates: (snapshot, state) => state.inventory.flatMap((entry) => {
      const definition = snapshot.items.find((item) => item.id === entry.itemId);
      if (!definition) return [];
      return [{
        // Settings aliases belong to the stable item definition while the
        // operation target remains this playthrough's concrete inventory entry.
        id: definition.id,
        label: definition.name,
        aliases: [definition.name, definition.key, ...definition.tags],
        target: { kind: "item", id: entry.instanceId },
      }];
    }),
  },
];
