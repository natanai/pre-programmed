let paused = false;
let resumeGeneration = 0;
let consumedResumeGeneration = 0;

/**
 * Author tasks pause passive player-runtime progression without creating a
 * second play state. Nested Author tasks share the same single pause boundary.
 */
export function setPlayerRuntimePaused(next: boolean) {
  if (paused === next) return;
  paused = next;
  if (!next) resumeGeneration += 1;
}

export function playerRuntimePaused() {
  return paused;
}

/**
 * True once after a pause ends. Real-time project clocks use this to rebase
 * their wall-clock baselines instead of treating time spent authoring as play.
 */
export function consumePlayerRuntimeResume() {
  if (consumedResumeGeneration === resumeGeneration) return false;
  consumedResumeGeneration = resumeGeneration;
  return true;
}
