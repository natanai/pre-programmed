import type { PlayState, ProjectSnapshot } from "../project/model";

/**
 * Feature-owned contribution to real-time project state progression.
 * The application shell owns scheduling; features own schedule identity,
 * timestamp reset semantics, and how a tick changes play state.
 */
export type ProjectClockContribution = {
  id: string;
  scheduleKey(snapshot: ProjectSnapshot): string;
  active(snapshot: ProjectSnapshot): boolean;
  reset(snapshot: ProjectSnapshot, state: PlayState, now: number): PlayState;
  advance(snapshot: ProjectSnapshot, state: PlayState, now: number): PlayState;
};
