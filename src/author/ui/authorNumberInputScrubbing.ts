import "./numberInputScrubber.css";

const SCRUB_ACTIVATION_PX = 7;
const PIXELS_PER_STEP = 7;
const FLICK_PROJECTION_MS = 85;
const MAX_FLICK_PROJECTION_PX = 140;
const MAX_DECIMAL_PLACES = 8;
const SCRUB_CLICK_SUPPRESSION_MS = 450;

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

type NumberScrubGesture = {
  input: HTMLInputElement;
  pointerId: number;
  startX: number;
  startY: number;
  startValue: number;
  step: number;
  decimalPlaces: number;
  min?: number;
  max?: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  scrubbing: boolean;
  changed: boolean;
};

function numberInputFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const input = target.closest(".author-workspace-layer input[type=\"number\"]");
  if (!(input instanceof HTMLInputElement)) return null;
  if (input.disabled || input.readOnly) return null;
  return input;
}

function decimalPlaces(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 0;
  const [mantissa, exponentText] = normalized.split("e");
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  const fractionLength = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, Math.min(MAX_DECIMAL_PLACES, fractionLength - (Number.isFinite(exponent) ? exponent : 0)));
}

function finiteAttribute(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scrubStep(input: HTMLInputElement) {
  const stepAttribute = input.getAttribute("step")?.trim() ?? "";
  if (stepAttribute && stepAttribute !== "any") {
    const parsed = Number(stepAttribute);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (stepAttribute === "any") {
    const places = decimalPlaces(input.value);
    return places > 0 ? 10 ** -places : 1;
  }
  return 1;
}

function scrubDecimalPlaces(input: HTMLInputElement, step: number) {
  return Math.min(
    MAX_DECIMAL_PLACES,
    Math.max(decimalPlaces(input.value), decimalPlaces(String(step))),
  );
}

function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

function normalizedNumber(value: number, places: number) {
  const rounded = Number(value.toFixed(places));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function setNativeNumberValue(input: HTMLInputElement, value: number, places: number) {
  const text = String(normalizedNumber(value, places));
  if (input.value === text) return false;
  if (nativeInputValueSetter) nativeInputValueSetter.call(input, text);
  else input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  return true;
}

function stepCountForDelta(deltaX: number) {
  return Math.round(deltaX / PIXELS_PER_STEP);
}

/**
 * Installs one shared coarse-pointer interaction for every numeric input inside
 * Author mode. Feature editors still own their values, validation, and onChange
 * behavior; this layer only turns horizontal touch movement into ordinary input
 * events so current and future Author number fields inherit the same gesture.
 */
export function installAuthorNumberInputScrubbing() {
  const appWindow = window as Window & { __preProgrammedAuthorNumberScrubbing?: boolean };
  if (appWindow.__preProgrammedAuthorNumberScrubbing) return;
  appWindow.__preProgrammedAuthorNumberScrubbing = true;

  let gesture: NumberScrubGesture | null = null;
  let lastScrubbedInput: HTMLInputElement | null = null;
  let lastScrubbedAt = 0;

  const applyDelta = (activeGesture: NumberScrubGesture, deltaX: number) => {
    const steps = stepCountForDelta(deltaX);
    const next = clamp(
      activeGesture.startValue + steps * activeGesture.step,
      activeGesture.min,
      activeGesture.max,
    );
    if (setNativeNumberValue(activeGesture.input, next, activeGesture.decimalPlaces)) {
      activeGesture.changed = true;
    }
  };

  const cleanupGesture = () => {
    if (!gesture) return;
    gesture.input.classList.remove("author-number-scrubbing");
    try {
      if (gesture.input.hasPointerCapture(gesture.pointerId)) {
        gesture.input.releasePointerCapture(gesture.pointerId);
      }
    } catch {
      // Pointer capture is only an enhancement; Safari may release it first.
    }
    gesture = null;
  };

  document.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || (event.pointerType !== "touch" && event.pointerType !== "pen")) return;
    const input = numberInputFromTarget(event.target);
    if (!input) return;
    const startValue = Number(input.value);
    if (!Number.isFinite(startValue)) return;
    const step = scrubStep(input);
    gesture = {
      input,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue,
      step,
      decimalPlaces: scrubDecimalPlaces(input, step),
      min: finiteAttribute(input.min),
      max: finiteAttribute(input.max),
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      scrubbing: false,
      changed: false,
    };
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!gesture.scrubbing) {
      if (absX < SCRUB_ACTIVATION_PX && absY < SCRUB_ACTIVATION_PX) return;
      if (absY > absX) {
        cleanupGesture();
        return;
      }
      if (absX < SCRUB_ACTIVATION_PX) return;
      gesture.scrubbing = true;
      gesture.input.blur();
      gesture.input.classList.add("author-number-scrubbing");
      try { gesture.input.setPointerCapture(event.pointerId); } catch { /* optional */ }
    }

    event.preventDefault();
    const now = performance.now();
    const elapsed = Math.max(1, now - gesture.lastTime);
    const instantaneousVelocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.velocityX = gesture.velocityX * 0.35 + instantaneousVelocity * 0.65;
    gesture.lastX = event.clientX;
    gesture.lastTime = now;
    applyDelta(gesture, deltaX);
  }, true);

  document.addEventListener("pointerup", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.scrubbing) {
      event.preventDefault();
      const age = performance.now() - gesture.lastTime;
      const projectedPixels = age <= 80
        ? Math.max(-MAX_FLICK_PROJECTION_PX, Math.min(MAX_FLICK_PROJECTION_PX, gesture.velocityX * FLICK_PROJECTION_MS))
        : 0;
      applyDelta(gesture, event.clientX - gesture.startX + projectedPixels);
      if (gesture.changed) {
        gesture.input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }
      lastScrubbedInput = gesture.input;
      lastScrubbedAt = performance.now();
    }
    cleanupGesture();
  }, true);

  document.addEventListener("pointercancel", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    cleanupGesture();
  }, true);

  document.addEventListener("click", (event) => {
    const input = numberInputFromTarget(event.target);
    if (!input || input !== lastScrubbedInput) return;
    if (performance.now() - lastScrubbedAt > SCRUB_CLICK_SUPPRESSION_MS) return;
    event.preventDefault();
    event.stopPropagation();
    input.blur();
    lastScrubbedInput = null;
  }, true);

  document.addEventListener("beforeinput", (event) => {
    const inputEvent = event as InputEvent;
    const input = numberInputFromTarget(inputEvent.target);
    if (!input || input.value !== "0" || inputEvent.isComposing) return;
    const inserted = inputEvent.data ?? "";
    if (!/^[1-9]$/.test(inserted)) return;
    inputEvent.preventDefault();
    if (nativeInputValueSetter) nativeInputValueSetter.call(input, inserted);
    else input.value = inserted;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }, true);
}
