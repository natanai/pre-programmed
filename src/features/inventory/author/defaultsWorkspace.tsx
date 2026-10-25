import { defineAuthorWorkspace } from "../../../author/ui/workspaceDefinition";
import type { ItemDefaults } from "../projectSettings";

export const itemDefaultsWorkspace = defineAuthorWorkspace<ItemDefaults>({
  id: "inventory-item-defaults",
  matches: (route) => route.type === "feature" && route.feature === "inventory" && route.workspace === "item-defaults",
  createDraft: (_route, context) => ({ ...context.snapshot.settings.itemDefaults }),
  save: async ({ context, draft }) => {
    const settings = { ...context.snapshot.settings, itemDefaults: { ...draft } };
    const result = await context.persist([{ type: "project.settings", settings }], "Changed new item defaults");
    return result.status === "saved" || result.status === "queued" ? { accepted: true, draft } : { accepted: false };
  },
  buildSpec: ({ draft, setDraft }) => ({
    id: "inventory-item-defaults",
    title: "NEW ITEM DEFAULTS",
    blocks: [{
      type: "section",
      id: "item-default-grid",
      label: "INVENTORY",
      children: [
        ...(["width", "height"] as const).map((field) => ({
          type: "field" as const,
          id: `item-default-${field}`,
          label: field.toUpperCase(),
          control: "number" as const,
          inputMode: "numeric" as const,
          value: draft[field],
          onChange: (value: string) => setDraft({ ...draft, [field]: Math.max(1, Math.min(9999, Math.round(Number(value) || 1))) }),
        })),
        { type: "toggle", id: "item-default-stackable", label: "STACKABLE", checked: draft.stackable, onChange: (stackable) => setDraft({ ...draft, stackable, maxStack: stackable ? draft.maxStack : 1 }) },
        { type: "field", id: "item-default-stack", label: "MAXIMUM STACK", control: "number", inputMode: "numeric", disabled: !draft.stackable, value: draft.maxStack, onChange: (value) => setDraft({ ...draft, maxStack: Math.max(1, Math.min(9999, Math.round(Number(value) || 1))) }) },
        { type: "field", id: "item-default-quantity", label: "STARTING QUANTITY", control: "number", inputMode: "numeric", value: draft.startingQuantity, onChange: (value) => setDraft({ ...draft, startingQuantity: Math.max(0, Math.min(9999, Math.round(Number(value) || 0))) }) },
        { type: "toggle", id: "item-default-removable", label: "REMOVABLE", checked: draft.removable, onChange: (removable) => setDraft({ ...draft, removable }) },
        { type: "toggle", id: "item-default-interactable", label: "ENABLE PLAYER OPERATIONS", checked: draft.interactable, onChange: (interactable) => setDraft({ ...draft, interactable }) },
      ],
    }, {
      type: "section",
      id: "item-default-equipment",
      label: "EQUIPMENT",
      children: [{
        type: "choice",
        id: "item-default-equipped-storage",
        label: "WHILE EQUIPPED",
        value: draft.equippedStorage ?? "inventory",
        onChange: (equippedStorage) => setDraft({ ...draft, equippedStorage: equippedStorage === "slot" ? "slot" : "inventory" }),
        options: [
          { value: "inventory", label: "STAYS IN INVENTORY" },
          { value: "slot", label: "USES BODY SLOT" },
        ],
      }],
    }],
  }),
});
