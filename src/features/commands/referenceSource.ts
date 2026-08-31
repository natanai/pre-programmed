import type { PlayState, ProjectSnapshot } from "../../engine/project/model";
import type { OperationTarget } from "../operations/model";

export type CommandReferenceCandidate = {
  id: string;
  label: string;
  /** Normal author-facing words supplied by the owning feature. */
  aliases: string[];
  /** Runtime operation target represented by this reference. */
  target: OperationTarget;
};

export type CommandReferenceSource = {
  kind: string;
  label: string;
  description: string;
  candidates: (snapshot: ProjectSnapshot, state: PlayState) => CommandReferenceCandidate[];
};
