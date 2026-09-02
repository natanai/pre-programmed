import type { DerivedValueProvider } from "../../engine/values/derivedValue";

export const COMMANDS_DERIVED_VALUE_PROVIDER: DerivedValueProvider = {
  id: "commands",
  label: "Commands",
  metrics: [{ id: "entered", label: "Commands entered" }],
  read(metric, _snapshot, state) {
    return metric === "entered" ? state.commandsEntered : undefined;
  },
};
