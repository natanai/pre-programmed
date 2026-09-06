import type { BodyBackgroundDefinition, BodyCanvasDefinition, BodySlotDefinition } from "./model";

export const DEFAULT_BODY_CANVAS: Readonly<BodyCanvasDefinition> = {
  width: 48,
  height: 64,
  fit: "contain",
};

export type LegacyBodyTypeDefinition = Omit<BodyBackgroundDefinition, "canvas"> & {
  canvas?: BodyCanvasDefinition;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

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
 * Body slots have one canonical geometry invariant: their logical width and height
 * are identical. Equal logical units render as equal screen pixels because the
 * Body diagram uses the owning canvas aspect ratio.
 *
 * Rectangular legacy slots are reduced to the largest square that fits inside the
 * old rectangle and remain centered on the same point. This avoids silently
 * enlarging a slot into neighboring body regions while upgrading older projects.
 */
export function normalizeBodySlotDefinition(slot: BodySlotDefinition, canvas: BodyCanvasDefinition): BodySlotDefinition {
  const minimumSide = Math.min(1, canvas.width, canvas.height);
  const sourceWidth = positiveFinite(slot.width) ? slot.width : minimumSide;
  const sourceHeight = positiveFinite(slot.height) ? slot.height : minimumSide;
  const sourceX = Number.isFinite(slot.x) ? slot.x : 0;
  const sourceY = Number.isFinite(slot.y) ? slot.y : 0;
  const maximumSide = Math.min(canvas.width, canvas.height);
  const side = clamp(Math.min(sourceWidth, sourceHeight), minimumSide, maximumSide);
  const centerX = sourceX + sourceWidth / 2;
  const centerY = sourceY + sourceHeight / 2;
  return {
    ...slot,
    x: clamp(centerX - side / 2, 0, canvas.width - side),
    y: clamp(centerY - side / 2, 0, canvas.height - side),
    width: side,
    height: side,
  };
}

/**
 * One-way browser-cache compatibility boundary. Durable database rows are migrated
 * separately; a body without `canvas` is therefore known to still contain the old
 * percentage slot coordinates and is converted once into the default 48×64 space.
 */
export function normalizeBodyTypeDefinition(value: LegacyBodyTypeDefinition | BodyBackgroundDefinition): BodyBackgroundDefinition {
  const hasCanvas = validBodyCanvas(value.canvas);
  const canvas = hasCanvas ? normalizeBodyCanvas(value.canvas) : { ...DEFAULT_BODY_CANVAS };
  return {
    ...value,
    canvas,
    slots: (value.slots ?? []).map((slot) => normalizeBodySlotDefinition(hasCanvas ? { ...slot } : legacyPercentageSlot(slot), canvas)),
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
  const squareTolerance = Number.EPSILON * Math.max(100, Math.abs(slot.width), Math.abs(slot.height));
  return Number.isFinite(slot.x)
    && Number.isFinite(slot.y)
    && positiveFinite(slot.width)
    && positiveFinite(slot.height)
    && Math.abs(slot.width - slot.height) <= squareTolerance
    && slot.x >= 0
    && slot.y >= 0
    && slot.x + slot.width <= canvas.width + Number.EPSILON * 100
    && slot.y + slot.height <= canvas.height + Number.EPSILON * 100;
}

/** Resize the logical coordinate system while preserving slot centers and square geometry. */
export function resizeBodyCanvas(
  bodyType: BodyBackgroundDefinition,
  width: number,
  height: number,
): BodyBackgroundDefinition {
  if (!positiveFinite(width) || !positiveFinite(height)) throw new Error("Body canvas dimensions must be positive numbers.");
  const current = normalizeBodyCanvas(bodyType.canvas);
  const xScale = width / current.width;
  const yScale = height / current.height;
  const sideScale = Math.min(xScale, yScale);
  return {
    ...bodyType,
    canvas: { ...current, width, height },
    slots: (bodyType.slots ?? []).map((candidate) => {
      const slot = normalizeBodySlotDefinition(candidate, current);
      const centerX = (slot.x + slot.width / 2) * xScale;
      const centerY = (slot.y + slot.height / 2) * yScale;
      const side = Math.min(slot.width * sideScale, width, height);
      return {
        ...slot,
        x: clamp(centerX - side / 2, 0, width - side),
        y: clamp(centerY - side / 2, 0, height - side),
        width: side,
        height: side,
      };
    }),
  };
}
