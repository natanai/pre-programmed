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

## Internals are not competing current task reports

`source-graph.json` is a large **machine-generated AST inventory**, not an imagined task catalog or source of truth for developer UX conclusions. `scripts/author-flow/navigation-model.mjs` is a pure on-demand compiler and CLI for low-level route questions; it no longer persists a second current navigation JSON. The task-lookup calculator imports that compiler directly.

Other checked-in `coverage.json`, `access-costs.json`, `choice-exposure.json`, `frontier-*.json`, `sequence-progress.json`, and `traces/` are **historical raw exploration evidence** from previous audit passes. They are not authoritative for anticipated tasks or recommended authoring experiences, and should not be regenerated during routine product work. Their legacy scripts remain available for exceptional forensic investigation, not everyday testing.

No GitHub Action regenerates this table. Do not add automatic browser crawls, UI-test matrices or new Actions for it. The user will report actual issues during normal use; developers can investigate and improve the engine directly using the source-based lookup.

## Development priorities

Use the unresolved entries to locate missing or poorly represented contextual resource creation and task-owner navigation, then repair the canonical feature contract. Do not invent genre-specific editors or new save paths. Preserve the suspended parent draft, nested owner, canonical Save, LIFO Back and master X to the real player terminal. **Clicks alone are not the optimization target; predictable action destinations and preserving creative context are.**
