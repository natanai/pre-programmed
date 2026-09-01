# Feature Boundary Rules

These rules protect Pre-Programmed's ability to replace experimental systems instead of patching around them.

The architectural target is:

> A feature owns its complete vertical slice. Core composes features; core does not implement feature internals.

The practical acceptance test is the deletion test described in `docs/modular-engine-roadmap.md`.

## 1. New behavior belongs with its owner

When adding behavior, first identify which system conceptually owns it.

Examples:

- inventory item behavior → `src/features/inventory/`
- narrative nodes/interactions/dialogue → `src/features/narrative/`
- variables/computed state → `src/features/state/`
- people/places → `src/features/world/`
- audio/art/synth behavior → `src/features/media/`
- player command grammar/resolution → `src/features/commands/`
- generic target operations → `src/features/operations/`

Do not add a feature-specific branch to `App.tsx`, `worker/projectStore.ts`, or a shared facade merely because those files can currently see everything. If a central integration point is still required, add the smallest explicit contribution/adapter and keep implementation behavior in the feature.

## 2. Composition roots are allowed to know which features exist

Modularity does **not** require runtime discovery or hiding the set of built-in modules.

An explicit composition root may import feature contributions and assemble them. Examples already present include:

- Author feature manifest registry
- condition/effect catalogs
- operation target catalog
- command capability/reference catalogs

A composition root should answer only questions such as:

> Which contributions are installed in this build?

It should not answer:

> How does Inventory execute `give_item`?

The first is composition. The second is feature implementation.

## 3. Cross-feature implementation imports are suspect

A feature should prefer stable shared/core contracts over importing another feature's internal runtime/UI files.

Before adding a cross-feature import, ask whether the dependency is actually one of these:

- a generic engine contract that should live in `src/engine/`;
- a generic operation/capability contract;
- an explicit composition concern;
- a genuine domain dependency that should be represented by an adapter/port rather than direct implementation knowledge.

Do not create circular feature ownership merely to avoid writing a small stable contract.

## 4. `src/game/*` is shrink-only compatibility architecture

The remaining `src/game/*` modules exist so the modularization can proceed without a flag-day import rewrite.

Rules:

- do not add a new system to `src/game/`;
- do not move new feature behavior into a compatibility facade;
- existing facade behavior should migrate toward its owning engine/feature module when touched safely;
- facades may re-export stable contracts while old imports remain;
- the directory should become smaller over time and may eventually disappear.

A bug fix may temporarily require touching a facade, but the preferred direction is always toward the owning module rather than expanding facade ownership.

## 5. `App.tsx` is an application shell, not a feature home

`App.tsx` is still transitional and currently coordinates too much.

New work should move it toward responsibility for:

- application/session composition;
- connecting the live game experience to shared runtime contracts;
- connecting Author experience to shared Author contracts;
- top-level presentation/session lifecycle.

It should move away from responsibility for:

- feature-specific persistence;
- feature-specific initialization;
- feature-specific commands;
- feature-specific mutation semantics;
- feature-specific Author editors.

Do not add a new feature-specific `if`/`switch` branch to App when a contribution/adapter can own it instead.

## 6. Worker persistence is transitional

`worker/projectStore.ts` currently has too much feature knowledge. Do not treat that as the desired pattern for new systems.

Until feature persistence contributions are introduced:

- avoid adding unrelated persistence behavior there unless required to make a feature durable;
- isolate new schema/read/write logic so it can move beside the owning feature later;
- do not create client-side repair layers to compensate for what persistence generated;
- keep revision/concurrency/transaction concerns distinct from feature record semantics.

The roadmap's persistence phase will move read/write/restore ownership behind feature contributions.

## 7. One Author implementation, many layouts

Desktop and mobile must not fork Author behavior.

Allowed:

- media queries;
- layout shells;
- responsive sizing/reflow;
- presentation-only controls whose action invokes an existing shared Author command/navigation path.

Not allowed:

- separate desktop/mobile editors for the same feature;
- separate desktop/mobile save logic;
- duplicate navigation stacks;
- desktop-only mutation semantics;
- copying an existing mobile component and evolving the copy independently.

The desktop left suite must remain a presentation of the same Author workspaces used on mobile.

## 8. Instance configuration is not engine behavior

A fork's Worker URL, D1 database ID/name, repository Pages path, credentials, and Author key belong to installation/setup configuration.

Do not hard-code a new installation's values into feature/runtime behavior.

Current hard-coded production fallbacks are transitional compatibility and should shrink as bootstrap/setup work is completed.

## 9. Prefer replacement over repair layers during prototyping

When a prototype system is conceptually wrong, do not preserve it solely because other systems have coupled themselves to it.

Prefer this sequence:

1. identify the intended stable contract;
2. isolate consumers behind that contract;
3. replace the owning implementation;
4. migrate durable authored data explicitly if needed;
5. delete the superseded implementation.

Avoid:

- runtime post-processors that repair another subsystem's output;
- two competing sources of truth;
- permanent compatibility branches for unshipped prototype behavior;
- CSS/JS layers whose purpose is to make an obsolete architecture appear correct.

Compatibility code may be used deliberately during migration, but it must have one-way direction toward deletion.

## Review question for every substantial change

Before merging, ask:

> If we replaced this feature next week, did this change make that replacement easier, neutral, or harder?

If the answer is "harder," the change needs an explicit architectural reason rather than convenience alone.
