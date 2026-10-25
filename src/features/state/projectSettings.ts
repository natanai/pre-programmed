export type StateVariableDefaults = {
  numberValue: number;
  flagValue: boolean;
  textValue: string;
  timeRate: number;
  timeUnit: "second" | "minute" | "hour";
  interactable: boolean;
};
export type StateProjectSettingsSlice = { variableDefaults: StateVariableDefaults };
export const DEFAULT_STATE_VARIABLE_DEFAULTS: StateVariableDefaults = {
  numberValue: 0, flagValue: false, textValue: "",
  timeRate: 0, timeUnit: "second", interactable: false,
};
export const DEFAULT_STATE_PROJECT_SETTINGS: StateProjectSettingsSlice = {
  variableDefaults: { ...DEFAULT_STATE_VARIABLE_DEFAULTS },
};
export function normalizeStateProjectSettings(root: Record<string, unknown>): StateProjectSettingsSlice {
  const raw = root.variableDefaults && typeof root.variableDefaults === "object"
    ? root.variableDefaults as Record<string, unknown>
    : {};
  return {
    variableDefaults: {
      numberValue: typeof raw.numberValue === "number" && Number.isFinite(raw.numberValue)
        ? raw.numberValue : 0,
      flagValue: typeof raw.flagValue === "boolean" ? raw.flagValue : false,
      textValue: typeof raw.textValue === "string" ? raw.textValue.slice(0, 1000) : "",
      timeRate: typeof raw.timeRate === "number" && Number.isFinite(raw.timeRate)
        ? raw.timeRate : 0,
      timeUnit: raw.timeUnit === "minute" || raw.timeUnit === "hour" ? raw.timeUnit : "second",
      interactable: raw.interactable === true,
    },
  };
}
