import { describe, expect, it } from "vitest";
import { PLAYER_INPUT_BINDING, runtimeBinding } from "../src/engine/rules/runtimeBindings";
import { setValueEffectAdapter } from "../src/features/state/author/ruleAdapters";

describe("effect authoring context", () => {
  it("defaults Set Value to captured player input only when the owner advertises that binding", () => {
    const captured = setValueEffectAdapter.create({ preferredRuntimeBindingKey: PLAYER_INPUT_BINDING });
    const ordinary = setValueEffectAdapter.create();

    expect(captured.type).toBe("set_value");
    if (captured.type !== "set_value") throw new Error("Expected set_value effect");
    expect(captured.value).toEqual(runtimeBinding(PLAYER_INPUT_BINDING));

    expect(ordinary.type).toBe("set_value");
    if (ordinary.type !== "set_value") throw new Error("Expected set_value effect");
    expect(ordinary.value).toBe(0);
  });
});
