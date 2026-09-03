import { describe, expect, it } from "vitest";
import {
  DEFAULT_BODY_CANVAS,
  bodySlotPercentRect,
  normalizeBodyTypeDefinition,
  resizeBodyCanvas,
  slotFitsBodyCanvas,
} from "../src/features/inventory/bodyCanvas";
import type { BodyBackgroundDefinition } from "../src/features/inventory/model";

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
    expect(migrated.slots?.[0]).toMatchObject({ x: 12, y: 32, width: 9.6, height: 6.4 });
    expect(bodySlotPercentRect(migrated.slots![0], migrated.canvas)).toEqual({ left: 25, top: 50, width: 20, height: 10 });
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
