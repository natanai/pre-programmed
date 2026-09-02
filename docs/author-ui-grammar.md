# Author UI Grammar

Pre-Programmed's Author experience is a recursive task system, not a collection of feature-owned pages.

The engine may be deeply composable internally, but that depth must not be reproduced as arbitrary visual heading depth. Feature data architecture therefore separates **authoring intent** from **presentation**.

## Stable rule

> Features describe what the author is doing. The shared Author system decides how that intent is presented at the current width and usable height.

Mobile and desktop use the same task model, draft model, controls, save semantics, and feature capabilities. Responsive presentation may reflow or compress those controls, including when the iOS visual viewport shrinks for the keyboard.

## Semantic workspace primitives

Data-first Author workspaces return `AuthorWorkspaceSpec` values built from a deliberately small vocabulary:

- `field` — edit one value;
- `choice` — choose one mutually exclusive path;
- `section` — one root-level conceptual group inside the task;
- `disclosure` — optional/advanced material without adding navigation depth;
- `status` — validation or feedback, not another heading;
- `custom` — a specialized control that cannot be represented by ordinary primitives.

A custom control is an escape hatch for things such as a rule tree, inventory grid, sequencer, or resource-results list. It does not own task headers, task footers, global navigation, or exit behavior.

## Finite visual hierarchy

A task owns one task title and one task-level action area.

A section cannot contain another section. Deeper conceptual work should become either:

- a semantic choice/disclosure inside the current task; or
- a genuine recursive Author subtask when it represents separately suspendable work.

This prevents domain nesting from manufacturing UI such as:

`RESPONSE → DESTINATION → CREATE NEW NODE → NEW NODE TEXT`

The intended representation is one semantic decision:

`AFTER → [STAY HERE] [CREATE NEW] [LINK EXISTING]`

Only the selected branch's controls are rendered.

## Labels describe information, not DOM depth

Fields keep accessible names, but a visible field label may be `sr-only` when the selected choice and placeholder already make its purpose unambiguous.

Workspace validation rejects a visible field label that merely repeats its parent option label. This makes redundant hierarchy an invalid data shape instead of something CSS must hide after the fact.

## Task persistence and exit semantics

Persistence, preview/testing, navigation, and exiting Author are separate concepts.

- `SAVE` persists the current task in context. It does not return to the player.
- Saving a newly created child resource may complete exactly that child task and return its typed resource result to its suspended parent.
- Preview temporarily exposes the player and always provides `RESUME EDITING`; it does not destroy the task stack.
- The master `[X]` is the Author-to-player exit boundary.
- If `[X]` is used with dirty tasks, the shared host offers `SAVE ALL & RETURN`, `DISCARD ALL & RETURN`, or `KEEP EDITING`.
- Save All processes dirty tasks deepest-first so a child resource can persist and complete into its parent before the parent is saved.

Feature code can register its task save boundary with the shared host. Data-first workspaces receive this automatically through `StructuredAuthorWorkspace`.

## Project mutations inside unsaved tasks

Nested controls should not publish unrelated project-wide mutations immediately from an unsaved parent task.

`useAuthorTaskTransaction` provides task-local staged mutations for controls whose changes belong to the parent's eventual transaction. A child control stages by stable key; the owning task commits the combined operations.

When a change must be its own task because it has an independent lifecycle, open a recursive Author subtask instead of silently persisting from a leaf control.

## New feature contract

New feature modules should contribute `feature.workspaces` definitions created with `defineAuthorWorkspace`.

A definition owns:

1. `createDraft` — feature-domain draft data;
2. `buildSpec` — semantic Author UI data;
3. `save` — feature-owned persistence semantics.

The shared `StructuredAuthorWorkspace` owns React draft lifecycle, dirty state, Save-All registration, validation/rendering, and task presentation.

The old `renderWorkspace()` manifest field is a migration-only escape hatch. The current prototype feature ids are listed centrally in `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`; new features must not expand that list casually. Tests fail when a new feature introduces unrestricted workspace rendering without an explicit core-policy change.

## Migration strategy

Do not preserve a prototype editor merely to keep old JSX structure stable.

When an editor is substantially changed:

1. identify its semantic task and draft;
2. flatten mutually exclusive branches into `choice` data;
3. convert optional complexity into `disclosure`;
4. move genuinely separate work into recursive tasks;
5. expose a task save boundary;
6. remove its legacy heading/footer markup;
7. remove the feature/workspace from the legacy exception surface when its migration is complete.

This is intentionally one-way. The goal is for the legacy Author presentation foundation to shrink as features evolve, while the semantic grammar remains stable.