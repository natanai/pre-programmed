import type { PlayState } from "../../engine/project/model";

export function initializeCommandsPlayState(state: PlayState): PlayState {
  return {
    ...state,
    commandsEntered: 0,
    lastCommand: "",
  };
}
