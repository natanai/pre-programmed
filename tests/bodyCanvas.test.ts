import { describe, expect, it } from "vitest";
import type { MutationOperation } from "../src/engine/project/model";
import {
  DEFAULT_BODY_CANVAS,
  bodySlotPercentRect,
  normalizeBodyTypeDefinition,
  resizeBodyCanvas,
  slotFitsBodyCanvas,
} from "../src/features/inventory/bodyCanvas";
import type { BodyBackgroundDefinition } from "../src/features/inventory/model";
import {
  normalizeInventoryMutationOperation,
  normalizeInventoryProjectSlice,
} from "../src/features/inventory/projectNormalization";

describe("Inventory Body logical canvas", () => {
  it("migrates legacy percentage slots into the default 48×64 logical space", () => {
    const migrated = normalizeBodyTypeDefinition({
      id: "body",
      name: "Legacy",
      assetId: "",
      slots: [{ id: "slot", key: "leg", name: "Leg", x: 25, y: 50, width: 20, height: 10 }],
      startingEquipment: [],
    });

    expect(migrated.canvas).toEqual(DEFAULT_BODY_CANVAS);
    const slot = migrated.slots?.[0];
    expect(slot?.x).toBeCloseTo(12);
    expect(slot?.y).toBeCloseTo(32);
    expect(slot?.width).toBeCloseTo(9.6);
    expect(slot?.height).toBeCloseTo(6.4);
    expect(bodySlotPercentRect(migrated.slots![0], migrated.canvas)).toEqual({ left: 25, top: 50, width: 20, height: 10 });
  });

  it("normalizes legacy Body Types recovered from the browser snapshot cache", () => {
    const normalized = normalizeInventoryProjectSlice({
      bodyBackgrounds: [{
        id: "cached-body",
        name: "Cached",
        assetId: "",
        slots: [{ id: "head", key: "head", name: "Head", x: 25, y: 10, width: 50, height: 20 }],
      }],
      startingBodyBackgroundId: "cached-body",
    });

    expect(normalized.startingBodyBackgroundId).toBe("cached-body");
    expect(normalized.bodyBackgrounds[0].canvas).toEqual(DEFAULT_BODY_CANVAS);
    expect(normalized.bodyBackgrounds[0].slots?.[0]).toMatchObject({ x: 12, y: 6.4, width: 24, height: 12.8 });
  });

  it("upgrades an offline legacy Body upsert before mutation replay", () => {
    const legacyOperation = {
      type: "bodyBackground.upsert",
      background: {
        id: "queued-body",
        name: "Queued",
        assetId: "",
        slots: [{ id: "hand", key: "hand", name: "Hand", x: 50, y: 50, width: 25, height: 25 }],
      },
    } as unknown as MutationOperation;

    const normalized = normalizeInventoryMutationOperation(legacyOperation);
    expect(normalized.type).toBe("bodyBackground.upsert");
    if (normalized.type !== "bodyBackground.upsert") throw new Error("Expected Body upsert normalization.");
    expect(normalized.background.canvas).toEqual(DEFAULT_BODY_CANVAS);
    expect(normalized.background.slots?.[0]).toMatchObject({ x: 24, y: 32, width: 12, height: 16 });
  });

  it("does not force new bodies into the portrait default", () => {
    const body: BodyBackgroundDefinition = {
      id: "dragon",
      name: "Dragon",
      assetId: "",
      canvas: { width: 96, height: 64, fit: "cover" },
      slots: [{ id: "wing", key: "wing", name: "Wing", x: 48, y: 8, width: 24, height: 20 }],
      startingEquipment: [],
    };
    expect(normalizeBodyTypeDefinition(body)).toEqual(body);
    expect(slotFitsBodyCanvas(body.slots![0], body.canvas)).toBe(true);
  });

  it("rescales existing slots when the author changes the body canvas dimensions", () => {
    const body: BodyBackgroundDefinition = {
      id: "body",
      name: "Body",
      assetId: "",
      canvas: { width: 48, height: 64, fit: "contain" },
      slots: [{ id: "head", key: "head", name: "Head", x: 12, y: 8, width: 24, height: 16 }],
      startingEquipment: [],
    };
    const resized = resizeBodyCanvas(body, 96, 32);
    expect(resized.canvas).toEqual({ width: 96, height: 32, fit: "contain" });
    expect(resized.slots?.[0]).toMatchObject({ x: 24, y: 4, width: 48, height: 8 });
  });
});
