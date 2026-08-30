import { describe, expect, it } from "vitest";
import { isSoftwareKeyboardOpen } from "../src/ui/viewport";

describe("mobile visual viewport", () => {
  it("recognizes a focused mobile editor after a meaningful height reduction", () => {
    expect(isSoftwareKeyboardOpen({
      viewportHeight: 470,
      maximumViewportHeight: 820,
      viewportWidth: 390,
      editableFocused: true,
    })).toBe(true);
  });

  it("does not mistake browser chrome, desktop resizing, or an unfocused page for the keyboard", () => {
    expect(isSoftwareKeyboardOpen({ viewportHeight: 730, maximumViewportHeight: 820, viewportWidth: 390, editableFocused: true })).toBe(false);
    expect(isSoftwareKeyboardOpen({ viewportHeight: 470, maximumViewportHeight: 820, viewportWidth: 900, editableFocused: true })).toBe(false);
    expect(isSoftwareKeyboardOpen({ viewportHeight: 470, maximumViewportHeight: 820, viewportWidth: 390, editableFocused: false })).toBe(false);
  });
});
