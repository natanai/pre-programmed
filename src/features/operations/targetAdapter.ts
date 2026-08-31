import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { OperationArguments, OperationHook, OperationId, OperationTarget } from "./model";

export type OperationPlacement = { x: number; y: number };

export type ResolvedOperationTarget = {
  definitionId: string;
  label: string;
  interactable: boolean;
  operations: OperationId[];
  hooks: OperationHook[];
};

export type TargetOperationResult = {
  accepted: boolean;
  state: PlayState;
  responseText?: string;
};

export type OperationTargetAdapter = {
  kind: string;
  resolve: (
    snapshot: ProjectSnapshot,
    state: PlayState,
    target: OperationTarget,
  ) => ResolvedOperationTarget | null;
  /** Optional target-owned mutation/validation after an authored hook succeeds. */
  applySuccessfulHook?: (args: {
    snapshot: ProjectSnapshot;
    state: PlayState;
    target: OperationTarget;
    operation: OperationId;
    arguments?: OperationArguments;
    placement?: OperationPlacement;
  }) => TargetOperationResult;
  /** Optional behavior when no authored hook handles the attempt. */
  defaultOperation?: (args: {
    snapshot: ProjectSnapshot;
    state: PlayState;
    target: OperationTarget;
    operation: OperationId;
    arguments?: OperationArguments;
    placement?: OperationPlacement;
  }) => TargetOperationResult;
};

export type AuthorOperationDefinition = {
  value: OperationId;
  label: string;
};
