# Author UI Grammar

Pre-Programmed's Author experience is a recursive task system, not a collection of unrelated feature pages.

The engine may be deeply composable internally, but implementation depth should not become visual depth. Feature modules describe **authoring intent**; the shared Author system decides how that intent is presented at the current width and usable height.

## Stable rule

> Features describe what the author is doing. The shared Author system decides how that task is presented.

Mobile and desktop use the same task model, draft state, controls, save semantics, feature capabilities, and persistence paths. Responsive presentation may reflow or compress those controls, including when a mobile visual viewport shrinks for the keyboard.

## Owning-editor reachability

The recursive task system also enforces a resource-ownership rule:

> **One authorable resource has one owning editor. Every Author-enabled surface that shows or references that resource should be able to enter that same editor directly.**

A referencing surface is an entry point, not a second owner. It may preview, select, summarize, create, or offer an edit affordance, but actual editing should open the feature-owned task responsible for that resource's draft, validation, and save semantics.

The parent task/workspace remains suspended while the owner task is nested, then resumes when the child returns. Authors should not have to back out to Author Tools and rediscover a resource they were already looking at.

This applies to live player surfaces augmented by Author mode as well as Author-only workspaces. If a player-visible Status row is backed by an authorable State definition, for example, Author mode should provide a direct route to the State-owned editor rather than duplicating State editing inside Status or requiring a manual detour through the State tool.

See [`author-resource-ownership.md`](author-resource-ownership.md) for the full ownership and reachability contract.

## Semantic workspace primitives

Data-first Author workspaces should express ordinary tasks through a small semantic vocabulary:

- `field` — edit text or a numeric value;
- `resource` — choose, create, preview, or enter the canonical editor for an authorable resource through the shared resource contract;
- `select` — choose one value from a conventional compact list;
- `toggle` — turn one boolean option on or off;
- `choice` — choose one mutually exclusive path, especially when the alternatives carry meaning or conditional content;
- `section` — one root-level conceptual group;
- `disclosure` — optional/advanced material without adding navigation depth;
- `action-row` — one or more contextual actions inside the current task body;
- `status` — validation or feedback;
- `custom` — a specialized control that cannot reasonably be represented by ordinary primitives.

A resource control is an entry point into the owning resource system, not an embedded foreign editor. Its ordinary choose/create/edit presentation belongs to shared Author UI; saving and validation remain with the resource owner's nested task.

An action row is for ordinary contextual actions such as opening a separately suspendable subtask. It does not replace the task-level Save area, Author Back/X navigation, or feature-owned persistence semantics.

A custom control may own specialized interaction such as a rule tree, inventory grid, body-slot layout, sequencer, drawing surface, or resource results. It should not duplicate ordinary fields/resources/selects/toggles/action rows, global task navigation, task headers, Author exit behavior, or persistence semantics.

## Finite visual hierarchy

A task owns one task title and one task-level action area.

A section should not manufacture another section hierarchy beneath itself. Deeper conceptual work should become either:

- a semantic choice/disclosure inside the current task; or
- a real recursive Author subtask when it represents separately suspendable work.

A route whose only meaningful action is forwarding to one child route is not an Author task. Route directly to the child instead. Likewise, a disclosure should not contain a specialized control whose only outer UI is another disclosure for the same concept. The parent owns that visual boundary; the child renders its working body.

For example, a destination decision should read as one decision such as:

```text
AFTER → [STAY HERE] [CREATE NEW] [LINK EXISTING]
```

rather than a stack of headings that mirrors object nesting.

## Labels describe information, not DOM depth

Fields keep accessible names. A visible label may be accessibility-only when the surrounding choice and placeholder already make the purpose unambiguous.

Avoid repeated parent/child labels whose only effect is visual nesting.

## Task persistence and exit semantics

Persistence, preview/testing, navigation, and leaving Author mode are separate concepts.

- `SAVE` persists the current task in context.
- Saving a newly created child resource may complete that child task and return its typed result to the suspended parent.
- Preview temporarily exposes the player without destroying the task stack.
- The master Author exit is the Author-to-player boundary.
- Dirty-task exit handling belongs to the shared host rather than individual features.
- Multi-task save behavior should preserve dependency order so child resources can persist before parents that reference them.

Feature code owns feature-domain save semantics; the shared Author host owns task lifecycle semantics.

## Mutations inside unsaved tasks

A nested control should not silently publish unrelated project-wide mutations from inside an unsaved parent task.

When a change belongs to the parent's eventual transaction, stage it with the task. When it has an independent lifecycle, open a recursive subtask.

The goal is for the author to understand what is saved, what is still draft, and what action will complete the current task.

## New feature contract

New feature workspaces should prefer data-first workspace definitions that separate:

1. draft creation;
2. semantic UI specification;
3. feature-owned save semantics.

The shared workspace host should own ordinary draft lifecycle, dirty state, validation, rendering, task presentation, and shared save/exit behavior.

Some existing feature surfaces may still use unrestricted custom workspace rendering. That is a current implementation detail, not a compatibility promise. Do not preserve an unsuitable editor merely to keep old JSX structure stable, and do not make unrestricted rendering the default for new features.

## Responsive authenticity test

For any desktop/mobile Author change:

1. open the same project and task at both presentations;
2. confirm both presentations use the same underlying workspace/task state;
3. confirm edits produce the same mutation and persistence semantics;
4. resize across presentation breakpoints with unsaved work present;
5. verify layout changes do not alter authored-data meaning or discard the task.

Responsive layout exists to improve visibility, not to create a second Author product.

## Replacement rule

When an Author editor is substantially redesigned, treat the current implementation as replaceable:

1. identify the semantic task and draft;
2. flatten mutually exclusive branches into choices;
3. move optional complexity into disclosures;
4. move independently suspendable work into subtasks;
5. keep feature-domain persistence with the feature;
6. delete superseded presentation structure and tests that only protected that structure.

The shared grammar should become more durable over time while prototype-specific markup remains free to disappear.
