import type { PlayState, ProjectSnapshot } from "../project/model";
import type { Value } from "../rules/model";

export type DerivedValueMetricDefinition = {
  id: string;
  label: string;
};

/** Shared contract implemented by features that expose read-only runtime metrics. */
export type DerivedValueProvider = {
  id: string;
  label: string;
  metrics: readonly DerivedValueMetricDefinition[];
  read: (metric: string, snapshot: ProjectSnapshot, state: PlayState, now: number) => Value | undefined;
};
