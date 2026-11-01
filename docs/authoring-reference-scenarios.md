# Author task lookup: play while building

This document describes **anticipated creative work**, not a manual playtest plan. The two reference games are a relationship-driven visual novel and a continually branching RPG. Both use the same canonical Author resources, state, player terminal, task stack, and save paths.

## The source of truth for development questions

- [Anticipated tasks](../audit/author-flow/anticipated-tasks.json) defines explicit hypothetical author goals, the workspace where each starts, nested resources required, and creative editing actions.
- [Navigation model](../audit/author-flow/navigation-model.json) is generated from the actual Author source declarations, resource owners, reference fields, and shared task lifecycle.
- [Task lookup](../audit/author-flow/task-lookup.json) joins these two sources into a queryable table: what source-declared route exists, where the next editor is owned, how many task layers are involved, which controls have conditional source-derived counts, and what remains unknown.
- [Calculator](../scripts/author-flow/task-lookup.mjs) regenerates the lookup deterministically, without a web browser, automated click traversal, game instance, or GitHub Actions.

The goals are **intentionally imagined in advance**. The route evidence is not. An absent static edge is reported as `no-reference-field-declared-in-current-workspace`, not as proof the UI cannot accomplish the task through another route. A source-declared edge is not proof of a successful Save or actual rendering.

## Ask a development question

From the repository root:

```sh
# Refresh only when the engine's source or anticipated tasks have changed
npm run audit:author:extract
node scripts/author-flow/navigation-model.mjs
node scripts/author-flow/task-lookup.mjs

# What does this intended task entail?
node scripts/author-flow/task-lookup.mjs --task vn-character-portrait
node scripts/author-flow/task-lookup.mjs --task rpg-create-destination

# Discover relevant goals and unresolved declared routes
node scripts/author-flow/task-lookup.mjs --search "relationship variable"
node scripts/author-flow/task-lookup.mjs --game branching-rpg
node scripts/author-flow/task-lookup.mjs --gaps
node scripts/author-flow/task-lookup.mjs --summary

# Compare today's static source-derived authoring paths to a prior snapshot
node scripts/author-flow/task-lookup.mjs --compare path/to/earlier-task-lookup.json

# Verify the table still matches the checked-in source model and task catalog
node scripts/author-flow/task-lookup.mjs --check
```

For a reproducible comparison, keep the earlier task lookup as a reference snapshot and run against the same anticipated-task definitions. The comparison identifies newly traceable routes, regressions, and changes in known conditional control subtotals. **It does not claim a lower click count proves improved usability.**

## What each task records

- **Starting context and goal:** a realistic authoring intention for one of the two games, with the current Author workspace explicitly identified. Getting there from the player terminal is an unknown until the engine exposes a source-queryable entry contract.
- **Actual resource routes:** each Create or Edit from the current referencing workspace through the canonical owning feature. A completed child transitions back to its suspended parent under the shared task contract.
- **Navigation structure:** number of nested tasks, feature-owner boundaries, conditional picker branches, and reverse resource-handoff order.
- **Conditional control subtotals:** reference Create/Edit activation, one enabled Save per child, one parent Save, and master X. These are **partial source-based counts only**. Data entry, field configuration, disabled states, confirmations, player entry, and actual browser presentation remain unknown. Exact end-to-end costs are always null.
- **Unknowns:** every required operation that is not modeled, ambiguous owner binding, missing declared contextual reference, or behavior that static source cannot establish.
- **Developer-facing friction indicators:** evidence that a task crosses owners, nests several resources, encounters a conditional chooser, or requires an unmodeled contextual route. They are observations about the graph, not a subjective score.

## The two game families

**Relationship-driven visual novel:** author new dialogue while playing, create a speaker or portrait in context, edit selected Characters, manage name reveals, dialogue variables and choice-dependent responses, capture nicknames, and revisit scenes. A major source-model question is whether State resources can be created *from inside* dialogue when their need becomes apparent.

**Continuously expanding RPG:** author a new player input, create the next Node and Location, create an NPC and portrait, introduce an inventory Item, add a locked-gate flag, author a stateful shortcut, and keep expanding the world from the current branch. A major source-model question is how Node, Item and State creation are exposed at the interaction that needs them.

The **shared objective** is predictable contextual nesting: every authorable thing that a menu needs should offer the canonical owning editor; nested work must suspend the parent, return the new resource identity, and resume the original task. Do not create genre-specific editors to satisfy a task.

When a lookup reports an unknown, the next development action is to investigate the **code and owning capability contract**, not to create another browser test or demand the user manually exercise the screen. The user may report actual problems encountered during normal play, which can then be reconciled with this model.
