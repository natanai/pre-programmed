import type { BodyBackgroundDefinition, BodyCanvasDefinition, BodySlotDefinition } from "./model";

export const DEFAULT_BODY_CANVAS: Readonly<BodyCanvasDefinition> = {
  width: 48,
  height: 64,
  fit: "contain",
};

export type LegacyBodyTypeDefinition = Omit<BodyBackgroundDefinition, "canvas"> & {
  canvas?: BodyCanvasDefinition;
};

function positiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validBodyCanvas(value: unknown): value is BodyCanvasDefinition {
  if (!value || typeof value !== "object") return false;
  const canvas = value as Partial<BodyCanvasDefinition>;
  return positiveFinite(canvas.width)
    && positiveFinite(canvas.height)
    && (canvas.fit === "contain" || canvas.fit === "cover");
}

export function normalizeBodyCanvas(value: unknown): BodyCanvasDefinition {
  if (!validBodyCanvas(value)) return { ...DEFAULT_BODY_CANVAS };
  return { width: value.width, height: value.height, fit: value.fit };
}

function legacyPercentageSlot(slot: BodySlotDefinition): BodySlotDefinition {
  return {
    ...slot,
    x: (slot.x / 100) * DEFAULT_BODY_CANVAS.width,
    y: (slot.y / 100) * DEFAULT_BODY_CANVAS.height,
    width: (slot.width / 100) * DEFAULT_BODY_CANVAS.width,
    height: (slot.height / 100) * DEFAULT_BODY_CANVAS.height,
  };
}

/**
 * One-way browser-cache compatibility boundary. Durable database rows are migrated
 * separately; a body without `canvas` is therefore known to still contain the old
 * percentage slot coordinates and is converted once into the default 48×64 space.
 */
export function normalizeBodyTypeDefinition(value: LegacyBodyTypeDefinition | BodyBackgroundDefinition): BodyBackgroundDefinition {
  const hasCanvas = validBodyCanvas(value.canvas);
  return {
    ...value,
    canvas: hasCanvas ? normalizeBodyCanvas(value.canvas) : { ...DEFAULT_BODY_CANVAS },
    slots: (value.slots ?? []).map((slot) => hasCanvas ? { ...slot } : legacyPercentageSlot(slot)),
    startingEquipment: [...(value.startingEquipment ?? [])],
  };
}

export function bodyCanvasAspectRatio(canvas: BodyCanvasDefinition) {
  return canvas.width / canvas.height;
}

export function bodySlotPercentRect(slot: BodySlotDefinition, canvas: BodyCanvasDefinition) {
  return {
    left: (slot.x / canvas.width) * 100,
    top: (slot.y / canvas.height) * 100,
    width: (slot.width / canvas.width) * 100,
    height: (slot.height / canvas.height) * 100,
  };
}

export function slotFitsBodyCanvas(slot: BodySlotDefinition, canvas: BodyCanvasDefinition) {
  return Number.isFinite(slot.x)
    && Number.isFinite(slot.y)
    && positiveFinite(slot.width)
    && positiveFinite(slot.height)
    && slot.x >= 0
    && slot.y >= 0
    && slot.x + slot.width <= canvas.width + Number.EPSILON * 100
    && slot.y + slot.height <= canvas.height + Number.EPSILON * 100;
}

/** Resize the logical coordinate system while preserving every slot's relative placement. */
export function resizeBodyCanvas(
  bodyType: BodyBackgroundDefinition,
  width: number,
  height: number,
): BodyBackgroundDefinition {
  if (!positiveFinite(width) || !positiveFinite(height)) throw new Error("Body canvas dimensions must be positive numbers.");
  const current = normalizeBodyCanvas(bodyType.canvas);
  const xScale = width / current.width;
  const yScale = height / current.height;
  return {
    ...bodyType,
    canvas: { ...current, width, height },
    slots: (bodyType.slots ?? []).map((slot) => ({
      ...slot,
      x: slot.x * xScale,
      y: slot.y * yScale,
      width: slot.width * xScale,
      height: slot.height * yScale,
    })),
  };
}
