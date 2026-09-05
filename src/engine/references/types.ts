import type { PlayState, ProjectSnapshot } from "../project/model";
import type { Value } from "../rules/model";

/** Stable identity of the one Author-owned resource behind a semantic reference. */
export type SemanticAuthorIdentity = {
  resourceKind: string;
  resourceId: string;
};

/** Generic operation-target transport. The Operations feature owns its semantics. */
export type SemanticOperationTarget = {
  kind: string;
  id: string;
};

/** One currently resolvable thing contributed by an installed feature. */
export type SemanticReferenceCandidate = {
  /** Stable candidate identity stored in authored reference tokens. */
  id: string;
  /** Short author-facing @ name. It is discovery vocabulary, not stored identity. */
  key: string;
  label: string;
  detail?: string;
  aliases: string[];
  /** Projection used when the author inserts the candidate without choosing a field. */
  defaultProjection: string;
  /** Optional default formatting rule for the default projection. */
  defaultFormat?: string;
  /** Readable values this candidate exposes to authored text and future consumers. */
  projections: Record<string, Value>;
  /** Present only when this candidate can participate in generic target operations. */
  target?: SemanticOperationTarget;
  /** Canonical Author owner currently represented by this candidate. */
  author?: SemanticAuthorIdentity;
  /** True for selectors such as current-location whose resolved owner may change by run state. */
  contextual?: boolean;
};

export type SemanticReferenceContext = {
  snapshot: ProjectSnapshot;
  state: PlayState;
  now?: number;
};

/**
 * Feature-owned semantic surface consumed by text references, Commands, and future engine tools.
 *
 * Providers describe their own domain once. Consumers must not import the feature's data/editor
 * implementation merely to discover or resolve references.
 */
export type SemanticReferenceProvider = {
  kind: string;
  label: string;
  description: string;
  /** Short human-facing namespace used in editable text, e.g. `location` or `variable`. */
  authorSyntax?: string;
  /** Contextual keys this provider owns in editable text, e.g. `current-location`. */
  authorContextKeys?: readonly string[];
  /** Canonical resource provider used to create new static candidates in Author mode. */
  authorResourceKind?: string;
  /** Projection inserted immediately after a nested create task returns a new resource. */
  defaultProjection?: string;
  /** Whether this provider may be selected for a Player Command target slot. */
  targetable?: boolean;
  candidates: (context: SemanticReferenceContext) => SemanticReferenceCandidate[];
  /** Static authored dependency represented by a stored candidate id. Contextual selectors return null. */
  projectResource?: (
    referenceId: string,
    snapshot: ProjectSnapshot,
  ) => SemanticAuthorIdentity | null;
};
