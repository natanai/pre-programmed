import type { PlayState, ProjectSnapshot } from "../project/model";
import type { OperationArguments, OperationId, OperationTarget } from "../../features/operations/model";
import type { TargetOperationResult } from "../../features/operations/targetAdapter";

export type PossessionServices = {
  removeFromPrimaryContainer: (state: PlayState, instanceId: string) => PlayState;
  returnToPrimaryContainer: (snapshot: ProjectSnapshot, state: PlayState, instanceId: string) => { accepted: boolean; state: PlayState };
};

export type PossessionOperationContext = {
  snapshot: ProjectSnapshot;
  state: PlayState;
  target: OperationTarget;
  operation: OperationId;
  arguments?: OperationArguments;
  services: PossessionServices;
};

export type PossessionExtension = {
  id: string;
  applyItemOperation?: (context: PossessionOperationContext) => TargetOperationResult | null;
  afterGrant?: (snapshot: ProjectSnapshot, before: PlayState, after: PlayState, itemId: string, services: PossessionServices) => PlayState;
  afterRemove?: (snapshot: ProjectSnapshot, before: PlayState, after: PlayState, removedInstanceIds: readonly string[], services: PossessionServices) => PlayState;
};
