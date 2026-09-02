# Feature Boundary Rules

These rules protect Pre-Programmed's ability to replace experimental systems instead of patching around them.

The architectural target is:

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

## 1. Put behavior with its owner

Before adding behavior, identify the feature that conceptually owns it.

Examples:

- narrative nodes, input, dialogue → `src/features/narrative/`
- player possessions and inventory presentation → `src/features/inventory/`
- body types, equipment slots, and equipped assignments → `src/features/equipment/`
- authored mutable values and read-only derived-value definitions → `src/features/values/`
- player-facing groups/views of values → `src/features/status/`
- people and places → `src/features/world/`
- audio, artwork, vector assets, synth → `src/features/media/`
- command grammar and resolution → `src/features/commands/`
- generic target operations → `src/features/operations/`

A feature should own its model, runtime behavior, Author contribution, validation, persistence contribution, and player presentation where applicable.

Do not put feature internals in `App.tsx`, shared Author shells, generic engine registries, or Worker orchestration merely because those files can see everything.

## 2. Composition roots may know which features are installed

Modularity does not require runtime discovery.

Explicit composition roots may import feature contributions and assemble them. A composition root may answer:

> Which contributions are installed in this build?

It should not answer:

> How does this feature execute its behavior?

The first is composition. The second belongs to the feature.

## 3. Prefer shared contracts over cross-feature implementation imports

A feature importing another feature's internal UI/runtime code is a warning sign.

Before adding such an import, ask whether the dependency is actually:

- a generic engine contract that belongs in `src/engine/`;
- a generic operation/capability contract;
- an explicit composition concern;
- a real domain dependency that should be represented through an adapter/port.

Current examples of intentional ports are the derived-value provider contract under `src/engine/values/` and possession extensions under `src/engine/possessions/`. A source feature contributes its own derived metric instead of Values importing that feature's implementation; Equipment extends possession behavior without turning Inventory into the owner of equipment semantics.

Avoid aggregate compatibility facades that hide ownership and become a second feature boundary.

## 4. `App.tsx` is a shell

`App.tsx` may compose application/session behavior, connect the player runtime to shared contracts, connect Author mode to shared contracts, and own top-level presentation lifecycle.

It should not become the implementation home for feature-specific persistence, initialization, commands, mutations, validation, or editors.

If a new feature requires a central `if`/`switch`, first look for a contribution or adapter boundary that lets the feature own the behavior instead.

## 5. Worker persistence composes feature ownership

Worker orchestration may coordinate transactions, revisions, authentication, schema initialization, and generic project reads/writes.

Feature-specific schema, persistence, mutation validation, and migration contributions belong with the owning Worker feature contribution under `worker/features/` or another explicit feature-owned boundary.

Do not re-centralize feature tables or validation into a master Worker file for convenience.

Historical one-way migrations may name superseded feature tables when that is necessary to move durable authored data into its new owner. That migration history is not a live compatibility API and must not require the new runtime/model to keep obsolete fields.

## 6. One Author implementation, many presentations

Desktop and mobile must use the same Author task state, navigation semantics, editors, mutations, validation, persistence, and save behavior.

Allowed responsive differences include:

- media queries;
- reflow and sizing;
- desktop split-pane presentation;
- mobile focused presentation;
- keyboard/visual-viewport adaptations;
- presentation-only controls that invoke existing shared Author actions.

Do not create separate desktop/mobile editors, mutation paths, save logic, or navigation stacks.

## 7. Installation configuration is not engine behavior

Worker names, database identities, repository paths, API origins, Author credentials, and optional provider configuration belong to installation/platform adapters.

Feature/project data should store stable project identities and content keys, not provider URLs or installation-specific IDs.

An optional provider may enable one capability; its absence must not disable unrelated engine features.

## 8. Replace unsuitable prototypes

When a prototype foundation is conceptually wrong:

1. identify the intended stable contract;
2. isolate consumers behind that contract;
3. replace the owning implementation;
4. migrate durable authored data only when needed;
5. delete the superseded implementation and obsolete compatibility code.

Avoid two sources of truth, repair layers around an obsolete subsystem, and permanent compatibility branches for unshipped prototype behavior.

Compatibility code is acceptable only as a deliberate one-way migration mechanism toward deletion.

## 9. Delete by feature boundary

A useful modularity check for a substantial feature replacement is:

1. remove the feature implementation;
2. remove its explicit registrations/composition entries;
3. do not repair unrelated feature internals;
4. a project that does not use the feature should still typecheck/build/run;
5. shared UI should not retain dead feature-specific entry points.

Do this when replacing a feature, not as permanent CI theater.

## 10. Verification must remain replaceable too

Tests and CI are architecture. They must not make an experimental feature harder to replace than the runtime does.

During rapid prototyping:

- production deployment on `main` is the only automatic workflow;
- full verification is an explicit checkpoint through `npm run verify`;
- use targeted checks while iterating;
- feature-specific tests may be deleted or rewritten with the feature;
- centralized tests should focus on cross-cutting safety contracts rather than enumerate the current feature roster;
- do not add tests whose main purpose is to freeze current routes, UI markup, feature lists, mutation lists, or prototype implementation details;
- stronger long-lived tests are justified for authentication, persistence, migrations, backup/restore, authored-data integrity, and similar boundaries whose failure can strand or corrupt work.

A failed test during an intentional replacement is evidence to inspect, not proof that the old behavior must be preserved.

## 11. Documentation describes the current engine

Tracked documentation is part of the developer interface.

Do not keep dated completion percentages, temporary probe results, branch-specific instructions, or historical implementation notes in the current developer docs after they stop describing the repository.

The Git history and pull requests preserve archaeology. The repository itself should describe what exists now and how to extend it safely.

## Review question

Before merging a substantial change, ask:

> If this feature were replaced next week, did this change make replacement easier, neutral, or harder?

If the answer is "harder," there should be an explicit architectural reason rather than convenience alone.
