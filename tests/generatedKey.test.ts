import { describe, expect, it } from "vitest";
import { normalizeAuthorKey, resolveAuthorKey } from "../src/author/generatedKey";

describe("Author generated keys", () => {
  it("derives a normalized identifier from a human label", () => {
    expect(normalizeAuthorKey("  North Nursery / Hall  ")).toBe("north-nursery-hall");
  });

  it("keeps an explicit stable key when one already exists", () => {
    expect(resolveAuthorKey({ override: "nursery", source: "New Nursery Name", existingKeys: ["other"] })).toBe("nursery");
  });

  it("generates a unique key when a new label collides", () => {
    expect(resolveAuthorKey({ override: "", source: "Nursery", existingKeys: ["nursery", "nursery-2"] })).toBe("nursery-3");
  });
});
