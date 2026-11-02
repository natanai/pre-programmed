# Author experience: one authoritative task lookup

**The single current source of truth for anticipated Author Mode workflows is [task-lookup.json](task-lookup.json).** It contains both the goals we're imagining for a relationship-driven visual novel and a continually branching RPG, and the source-derived evaluation of each goal. Do not create a second UX report, decision-tree JSON, scorecard, checklist or Markdown interpretation that attempts to describe the same current workflow experience.

The lookup is *not* an observation or a manual browser test. The engine's real source declarations determine which paths and controls are known; the task definitions in the same JSON determine which goals we are evaluating. Absence of a source-derived route is an unknown, not proof that the UI cannot do it. Present source-declared control counts only as conditional subtotals, never exact clicks, time, or proof of working Save/Back.

## Use the lookup, locally and only when needed

```sh
# Rebuild the lower-level code inventory only when source changed
npm run audit:author:extract

# The only authoring-experience report that should be regenerated or checked
node scripts/author-flow/task-lookup.mjs
node scripts/author-flow/task-lookup.mjs --check
node scripts/author-flow/task-lookup.mjs --summary
node scripts/author-flow/task-lookup.mjs --task vn-character-portrait
node scripts/author-flow/task-lookup.mjs --task rpg-create-destination
node scripts/author-flow/task-lookup.mjs --search "nickname"
node scripts/author-flow/task-lookup.mjs --gaps

# Compare against a deliberately saved older copy of the same lookup table
node scripts/author-flow/task-lookup.mjs --compare /path/to/older-task-lookup.json
```

**To add a task**, edit the `definition` of an existing task or append one task object in `task-lookup.json`, with a unique `id`, `game`, `goal`, starting workspace, `resource_chain`, `author_work`, `requested_operations`, and `finish`. Then rerun the calculator. Each `requested_operations` entry describes an anticipated author operation and names its corresponding source-witness key. These definitions are intentional hypotheses; the generated route and operation results come from the actual code, and are rebuilt without changing the definitions. No parallel task registry is maintained.

The generated evaluation includes:
- Exact source file and line for declared resource-owner routes, reference fields, and operation controls.
- Nested task depth, owner changes, conditional chooser paths, and source-declared return/handoff order.
- `operation_steps` for requested work such as composing an input, selecting a speaker, changing a condition, setting an effect, writing narration or assigning a destination.
- Explicit `unmodeled_or_unresolved` entries for inaccessible source bindings, dynamic conditions, omitted steps and behavior not proven by static code.
- `--compare` reports changed source visibility and witnesses for the same task IDs across revisions.

## Trace delegated authoring decisions

The lookup now follows **source-declared component composition and registered feature-owned rule adapters**, not only direct resource-picker fields. This matters for tasks that create a Flag from a response's WHEN condition, a relationship Variable from a numeric Effect, an Item from a GIVE ITEM Effect, a text Variable from AFTER → CAPTURE INPUT, or another Node through the real destination task. The Character alias WHEN rule similarly uses the canonical State adapter rather than a separate flag editor.

A route with several possible adapters records **every source-declared alternative**, its source lines and the conditional decisions required to expose the reference field. These choices are not all traversed for one task. The `source_declared_access_stages` range is a count of *described stages*, **not a physical click count**. Conditional control totals remain null when a nested adapter's UI steps cannot be reliably counted.

```sh
# A compact, deterministic comparison of documented complexity dimensions.
node scripts/author-flow/task-lookup.mjs --complexity
node scripts/author-flow/task-lookup.mjs --task rpg-inventory-loot
node scripts/author-flow/task-lookup.mjs --task vn-capture-nickname
node scripts/author-flow/task-lookup.mjs --task vn-rename-reveal-flag
```

The complexity query sorts by unresolved route, unresolved requested operation, described decision stages and feature-owner crossings. **It is not a subjective UX ranking or a scalar "clunkiness" score.** `--compare` includes decision-stage changes and owner crossings, so agents can see what changed for the *same imagined task* between source revisions.

A Node's `+ VALID INPUT` opens the canonical Interaction editor; the lookup records that as an **additional owning Author task**, rather than falsely treating the Node as containing a second player-input editor.

### Controlling when image assets appear

For the visual-novel reference game, the author wants to **choose when art appears**, not maintain a persistent background. The canonical Media `show sprite/art` effect already has two source-declared trigger locations:

- `vn-show-entry-art`: Node → ON ENTER → Show Sprite/Art. The effect fires when the player enters that Node.
- `vn-show-response-art`: Interaction response → EFFECTS → Show Sprite/Art. The effect fires when that response is selected and executes, after any WHEN selection check.

Both use the same canonical Media-owned `media-image` reference and its existing asset editor. The resulting art is displayed **inline or as an overlay** according to the Media asset's presentation setting. This is a property of the asset, not a separate effect-timing setting. Current source evidence does **not** establish per-word/per-frame timing or a specific authored dismissal duration; do not claim those controls exist.

```sh
node scripts/author-flow/task-lookup.mjs --steps vn-show-entry-art
node scripts/author-flow/task-lookup.mjs --steps vn-show-response-art
```

The single lookup records the trigger and the source chain reaching the player presenter. It does not claim that the image was visually observed in a browser.

## Intended adapter and control-count evidence

When a hypothetical task depends on a resource that is referenced by **multiple** conditions or effects, the task definition's `resource_chain[].via` names the particular existing owner adapter it intends to use (`channel` plus `adapter`). The calculator requires that exact source-declared adapter; it never silently picks an unrelated alternative. All other eligible adapters are listed as **unselected alternatives**, so they do not inflate the length of the intended route.

Examples in the one task lookup:

- `rpg-inventory-loot` chooses `effect:give_item`, not `condition:has_item` or `effect:remove_item`.
- `vn-track-affinity` chooses `effect:increment`, not `effect:decrement`.
- `vn-choice-branch` and `rpg-gate-condition` choose `condition:flag`.
- `vn-show-entry-art` and `vn-show-response-art` both choose Media's `effect:art`, but from different real authoring triggers (Node entry versus selected dialogue outcome).

For six single-resource condition/effect workflows, `measures.source_guarded_control_activations` now records the **individual code-witnessed controls** and a conditional activation range. The estimate follows the source-level disclosure, effect/type chooser, canonical ReferenceField's direct-create or chooser path, enabled child Save, enabled parent Save, and master X. When an Interaction response might already be open, its opening control contributes zero to one activation. When the resource catalog is nonempty, ReferenceField may need an additional chooser selection.

```sh
node scripts/author-flow/task-lookup.mjs --task rpg-inventory-loot
node scripts/author-flow/task-lookup.mjs --task vn-track-affinity
node scripts/author-flow/task-lookup.mjs --complexity
node scripts/author-flow/task-lookup.mjs --compare path/to/older-task-lookup.json
```

These counts are **partial, conditional source estimates**, not measured task-completion clicks or usability scores. They exclude entering Author Mode from the player terminal, typing or otherwise configuring authored fields, other screens inside the owning resource editor, Save rejection, and leave confirmation. A previously opened disclosure can also change the count. For tasks without an entirely source-supported single-adapter path, the metric remains `null`.

## Trace the work inside a response

The single lookup now includes `tasks[].operation_steps[].authoring_control_path`, derived from the real Narrative `InteractionEditor`, `NarrativeAfterEditor`, `ConditionEditor`, `EffectsEditor`, Node input controls and their shared disclosure components. This records the actual **sequence of declared controls** for anticipated actions rather than stopping once a resource editor is reachable.

The traced operations include: entering a valid player phrase; opening or adding a response; editing its narration; opening WHEN and choosing a condition; opening EFFECTS, adding an effect and selecting its owner adapter; opening AFTER and choosing CAPTURE INPUT; linking an existing Node or creating a new destination; and creating a valid input through a Node's canonical Interaction task.

```sh
node scripts/author-flow/task-lookup.mjs --task vn-author-new-reply
node scripts/author-flow/task-lookup.mjs --steps vn-choice-branch
node scripts/author-flow/task-lookup.mjs --steps vn-capture-nickname
node scripts/author-flow/task-lookup.mjs --steps rpg-define-north-input
node scripts/author-flow/task-lookup.mjs --task rpg-create-destination
```

The `--steps` view is a concise projection of the **same lookup JSON**, not a separate report. It lists the intended resource tasks, each requested operation, concrete control labels with source file/line evidence, conditional ranges, and explicitly unknown steps.

One crucial distinction: `[+ ADD RESPONSE]` creates a draft **and opens it automatically**, so the new response does not require a second "open response" step. A route with a known `outcomeId` may already open a response, whereas selecting an existing response from its overview needs another activation.

Each operation's `conditional_navigation_activations` is a **local, non-additive estimate**, with source file/line evidence and explicit preconditions. Text typing, editing amounts or conditions, choosing an item from a dynamic list, Save success, and returning to play remain outside these operation-level numbers. Do **not sum** the operation ranges with each other or with nested-resource ranges: the same disclosure, response selection or canonical resource picker may appear in both representations. The overall end-to-end cost stays unknown.

An unspecified destination is not silently treated as an existing Node. The RPG northward-input example explicitly chooses `destination_choice: "existing"` in its task definition; the new-Node example uses its existing canonical Node creation task. The existing-destination chooser is dynamic, so the whole operation's bound remains null.

## Field-level configuration evidence

For registered condition/effect adapters, the lookup now extracts the actual JSX controls and literal `create()` defaults from the **owning feature** into `route_steps[].field_configuration`. It also references relevant fields in the canonical State, Inventory or Media owner editor. This is part of the **same JSON**, not another audit or duplicate schema.

Examples: Give Item provides a canonical Item reference and a quantity field defaulting to `1`; Increment provides a number-variable reference and an amount defaulting to `1`; a Flag condition defaults to global scope and a true check, with Node-local scope as a conditional alternate. The media art effect selects an asset; its inline/overlay presentation choice lives with that asset's Media definition.

The lookup distinguishes **a declared control**, **its source default**, **whether a non-default change might be needed**, and **unmeasured typed/configured input**. It does not turn every field into one assumed click. If the task has not specified a value or non-default choice, that amount of work remains unknown.

```sh
node scripts/author-flow/task-lookup.mjs --steps rpg-inventory-loot
node scripts/author-flow/task-lookup.mjs --steps vn-track-affinity
node scripts/author-flow/task-lookup.mjs --steps vn-show-response-art
```

## Internals are not competing current task reports

`source-graph.json` is a large **machine-generated AST inventory**, not an imagined task catalog or source of truth for developer UX conclusions. `scripts/author-flow/navigation-model.mjs` is a pure on-demand compiler and CLI for low-level route questions; it no longer persists a second current navigation JSON. The task-lookup calculator imports that compiler directly.

Other checked-in `coverage.json`, `access-costs.json`, `choice-exposure.json`, `frontier-*.json`, `sequence-progress.json`, and `traces/` are **historical raw exploration evidence** from previous audit passes. They are not authoritative for anticipated tasks or recommended authoring experiences, and should not be regenerated during routine product work. Their legacy scripts remain available for exceptional forensic investigation, not everyday testing.

No GitHub Action regenerates this table. Do not add automatic browser crawls, UI-test matrices or new Actions for it. The user will report actual issues during normal use; developers can investigate and improve the engine directly using the source-based lookup.

## Development priorities

Use the unresolved entries to locate missing or poorly represented contextual resource creation and task-owner navigation, then repair the canonical feature contract. Do not invent genre-specific editors or new save paths. Preserve the suspended parent draft, nested owner, canonical Save, LIFO Back and master X to the real player terminal. **Clicks alone are not the optimization target; predictable action destinations and preserving creative context are.**
