import { authoredSource } from "../../engine/presentation/authoredSource";
import type { OperationTargetAdapter } from "../operations/targetAdapter";

export const PLAYER_COMMAND_OPERATION_TARGET_KIND = "player-command";
export const PLAYER_COMMAND_RESPONSE_OPERATION = "commands.respond";

/**
 * A text-response Player Command is itself the durable target definition.
 * Routing it through Operations keeps response effects/interpolation on the same
 * runtime path as every other feature instead of adding a command-only executor.
 */
export const PLAYER_COMMAND_OPERATION_TARGET_ADAPTER: OperationTargetAdapter = {
  kind: PLAYER_COMMAND_OPERATION_TARGET_KIND,
  resolve(snapshot, _state, target) {
    if (target.kind !== PLAYER_COMMAND_OPERATION_TARGET_KIND) return null;
    const command = snapshot.settings.commands.commands.find((candidate) => candidate.id === target.id);
    if (!command || command.action.type !== "response") return null;
    return {
      definitionId: command.id,
      label: command.label || "Player command",
      interactable: true,
      operations: [PLAYER_COMMAND_RESPONSE_OPERATION],
      hooks: [{
        id: `${command.id}:response`,
        operation: PLAYER_COMMAND_RESPONSE_OPERATION,
        order: 0,
        condition: { type: "always" },
        responseText: command.action.responseText,
        effects: command.action.effects,
        success: true,
      }],
      authorSource: authoredSource("player-command", command.id),
    };
  },
};
