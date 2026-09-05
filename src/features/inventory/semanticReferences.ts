import type { SemanticReferenceProvider } from "../../engine/references/types";

export const INVENTORY_SEMANTIC_REFERENCE_PROVIDERS: readonly SemanticReferenceProvider[] = [
  {
    kind: "inventory.item",
    label: "Items",
    description: "Authored item definitions; command targets resolve to a carried instance when present.",
    authorResourceKind: "item",
    defaultProjection: "name",
    targetable: true,
    candidates: ({ snapshot, state }) => snapshot.items.map((definition) => {
      const entries = state.inventory.filter((entry) => entry.itemId === definition.id);
      const quantity = entries.reduce((total, entry) => total + entry.quantity, 0);
      const targetEntry = entries[0];
      return {
        id: definition.id,
        key: definition.key,
        label: definition.name || definition.key,
        detail: quantity ? `carried ×${quantity}` : "not currently carried",
        aliases: [definition.name, definition.key, ...definition.tags].filter(Boolean),
        defaultProjection: "name",
        projections: {
          name: definition.name,
          key: definition.key,
          description: definition.description,
          quantity,
        },
        ...(targetEntry ? { target: { kind: "item", id: targetEntry.instanceId } } : {}),
        author: { resourceKind: "item", resourceId: definition.id },
      };
    }),
    projectResource: (id, snapshot) => snapshot.items.some((definition) => definition.id === id)
      ? { resourceKind: "item", resourceId: id }
      : null,
  },
  {
    kind: "inventory.body-type",
    label: "Body types",
    description: "Authored body/equipment layouts and the body type active in the current run.",
    authorResourceKind: "body-type",
    defaultProjection: "name",
    candidates: ({ snapshot, state }) => {
      const active = snapshot.bodyBackgrounds.find((bodyType) => bodyType.id === state.bodyBackgroundId);
      return [
        {
          id: "current",
          key: "current-body-type",
          label: "Current body type",
          detail: active?.name || "No active body type",
          aliases: ["current body", "current body type", "body"],
          defaultProjection: "name",
          projections: { name: active?.name ?? "" },
          author: active ? { resourceKind: "body-type", resourceId: active.id } : undefined,
          contextual: true,
        },
        ...snapshot.bodyBackgrounds.map((bodyType) => ({
          id: bodyType.id,
          key: bodyType.id,
          label: bodyType.name || "Untitled body type",
          aliases: [bodyType.name].filter(Boolean),
          defaultProjection: "name",
          projections: { name: bodyType.name },
          author: { resourceKind: "body-type", resourceId: bodyType.id },
        })),
      ];
    },
    projectResource: (id, snapshot) => id !== "current" && snapshot.bodyBackgrounds.some((definition) => definition.id === id)
      ? { resourceKind: "body-type", resourceId: id }
      : null,
  },
];
