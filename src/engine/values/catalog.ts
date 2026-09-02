import { COMMANDS_DERIVED_VALUE_PROVIDER } from "../../features/commands/derivedValues";
import { INVENTORY_DERIVED_VALUE_PROVIDER } from "../../features/inventory/derivedValues";
import { NARRATIVE_DERIVED_VALUE_PROVIDER } from "../../features/narrative/derivedValues";
import type { DerivedValueProvider } from "./derivedValue";

const SESSION_DERIVED_VALUE_PROVIDER: DerivedValueProvider = {
  id: "session",
  label: "Session",
  metrics: [{ id: "elapsed_seconds", label: "Elapsed seconds" }],
  read(metric, _snapshot, state, now) {
    return metric === "elapsed_seconds" ? Math.max(0, (now - state.sessionStartedAt) / 1000) : undefined;
  },
};

/** Explicit composition root for installed read-only value providers. */
export const DERIVED_VALUE_PROVIDERS: readonly DerivedValueProvider[] = [
  SESSION_DERIVED_VALUE_PROVIDER,
  COMMANDS_DERIVED_VALUE_PROVIDER,
  NARRATIVE_DERIVED_VALUE_PROVIDER,
  INVENTORY_DERIVED_VALUE_PROVIDER,
];

export function derivedValueProvider(id: string) {
  return DERIVED_VALUE_PROVIDERS.find((provider) => provider.id === id);
}
