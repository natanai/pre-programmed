# Author Resource Ownership and Reachability

Pre-Programmed is built around **play and build at the same time**. In Author mode, that means an author should not have to remember which top-level tool owns a thing before they can edit it.

The core rule is:

> **One authorable resource has one owning editor. Every Author-enabled surface that shows or references that resource should be able to enter that same editor directly.**

A short version is: **seen means editable**.

This is a modularity rule, not just a convenience rule. It keeps editing behavior with the feature that owns the data while allowing every other feature to reuse that editor through the recursive Author task system.

## Core Author mode rules at a glance

These are the compact invariants to preserve during rapid prototyping:

1. **Play stays play.** Author mode augments the real running game; it does not replace player systems with Author copies.
2. **Author Tools are author-facing.** A tool should manage or configure authored game systems, not merely preview what the player already sees.
3. **Seen means editable.** If Author mode shows or references an authorable definition, the author can reach its canonical editor from that context.
4. **One resource, one owner, one save authority.** Other surfaces may reference a resource, but they do not recreate its editor, validation, draft state, or persistence path.
5. **Normal interaction and editing coexist.** Author mode adds edit/create affordances without stealing the surface's normal play, follow, select, inspect, or navigation action.
6. **Nesting is the reuse mechanism.** Cross-feature editing opens the owning task recursively, preserves the suspended parent, and returns to it with Back/save completion; the master `[X]` returns to play.
7. **Creation uses the owner too.** A referencing surface may offer `+ Create`, but it launches the owning resource task instead of a local mini-editor.
8. **Runtime presentation preserves authoring provenance.** Player-visible authored output must retain enough stable source identity for Author mode to open the definition that produced it instead of flattening that identity away.
9. **Cross-feature access uses contracts.** Features expose resources/capabilities/routes through shared composition contracts rather than importing and embedding one another's editor implementations.
10. **Desktop and mobile are one Author system.** They use the same tasks, editors, mutations, save semantics, and capabilities; only responsive presentation may differ.

Transient run controls are allowed when they are clearly about testing the current playthrough (for example, `ADD TO RUN` or `USE THIS RUN`). They must not become a second durable editing path for project definitions.

## 1. One resource, one owning editor

Every durable authorable resource or definition has one feature that owns its canonical editor and save semantics.

Examples include:

- a State variable or computed value → State-owned editor;
- a player-visible State group → State-owned group editor;
- an Inventory item → Inventory-owned Item editor;
- a Body Type or body slot → Inventory-owned Body/Slot editor;
- a Character or Location → World-owned editor;
- a Node, Interaction, or Response → Narrative-owned editor;
- a Media asset or synth definition → Media-owned editor;
- a Player Command → Commands-owned editor.

Another feature may display, select, summarize, or reference that resource. It should **not** recreate a second editor for it.

If two surfaces can independently edit the same durable definition using different forms, validation, draft state, or save paths, the feature boundary is already drifting.

## 2. References are entry points, not ownership transfers

When a surface references an authorable resource, Author mode should make that reference a direct entry point into the resource's owning editor.

The referencing surface may add contextual actions such as select, clear, create, inspect, or edit. When actual editing begins, it should open the owning feature's real Author task.

For example, a player-visible Status surface may display a State value. In Author mode that row should be able to open the State-owned editor for the relevant group/value directly. The Status surface should not tell the author to close it, open the State tool, and search for the value manually, and it should not grow a duplicate State editor inside Status.

Likewise, an Inventory item referenced by a rule, a Character selected as a speaker, or a Media image selected by a Body Type should all be editable from the place where the author encounters the reference.

## 3. Recursive nesting is the reuse mechanism

The shared Author task runtime exists so one owning editor can be reached from many contexts without duplication.

When surface A opens the editor owned by feature B:

1. A remains mounted and suspended;
2. B opens as a real nested Author task;
3. B owns its draft, validation, and save behavior;
4. saving/completing B returns the relevant typed result to A when needed;
5. A's unsaved draft, scroll position, and local task state remain intact;
6. Back returns to A; the master Author X remains the only Author-to-player exit.

This nesting may continue recursively. An Item editor may open a Media editor; that Media editor may open another owned resource task if the workflow requires it. The system should not impose an arbitrary depth limit or force the author back to a tool index between related edits.

## 4. Direct editability applies wherever Author mode exposes the thing

For an authorable definition, every meaningful Author-enabled presentation should ask:

> If the author sees this thing here, can they edit the canonical definition from here?

This includes:

- Author tool lists and search results;
- live player workspaces augmented by Author mode;
- author-facing summary cards and resource lists;
- relationship/reference fields;
- rule, condition, effect, and operation configuration;
- author-facing views of player-visible groups or values;
- nested editors that mention another resource.

The edit affordance does not have to be visually loud. A row may itself open the editor, or a compact `[EDIT]` action may appear in Author mode. The important requirement is that the author does not have to navigate away and rediscover the same resource through its owner's top-level tool.

This rule applies to **authorable definitions**, not every transient runtime value. A live numeric value, resolved condition result, generated output string, or other runtime-only projection may not itself be durable author data. In that case the Author affordance should lead to the definition that controls it when one exists.

### Preserve the surface's normal action

Direct editability is additive. If the thing already has a meaningful player or navigation action, Author mode should preserve it and add editing alongside it.

Examples:

- a Structure destination can still be followed while also offering `EDIT` for the destination Node;
- an Inventory item can still be selected/used while also offering a route to its Item editor;
- a Status group can still open its player entries while also offering a route to its State group editor;
- a Media thumbnail can still open the player viewer while also offering a route to the Media editor.

Do not make authors choose between navigating the game and editing it merely because both actions concern the same visible thing.

### Preserve authoring provenance through play

The runtime should not flatten away the identity needed to edit authored output.

When player presentation originates from authored content—such as Node prose, an Interaction response, an operation response, a Character speaker, a State interpolation, a Media asset, or an authored effect—the presentation path should retain enough stable provenance to identify the controlling resource and, when useful, the relevant subpart/operation.

That provenance is an Author bridge, not player-facing game data. Ordinary players do not receive Author task or persistence capabilities. While Author mode is active, however, the live surface can use the provenance to open the owning editor directly.

If a renderer receives only a flattened string or anonymous event and can no longer tell which authored definition produced it, direct Author editability has already been lost upstream.

## 5. Play surfaces and Author tools have different jobs

Author mode augments the running game rather than replacing player-facing systems.

The literal player experience belongs to the player layer. If an author wants to see exactly what a player sees, they should use the real player surface while Author mode is active or return fully to play. Author mode may add contextual edit affordances to that live surface, but it should not manufacture a second player preview inside Author Tools.

Author Tools are author-facing destinations. A tool named `PLAYER STATUS` may be a valuable direct navigation target, but its job is to author Status groups and values. A tool named `INVENTORY` may be a valuable direct navigation target, but its job is to author item/body definitions and configuration. Neither should merely embed the player Status or Inventory UI as an Author task.

If the player is looking at Inventory, Status, a character-facing surface, or another player workspace while Author mode is active, the feature may contribute contextual editing affordances. Those affordances should open the same owning Author tasks used everywhere else.

Do not build an Author-only copy of a player workspace just to make its contents editable.

Do not build a preview-only Author tool when the real player workspace already exists.

The desired live-play flow is:

```text
play / open player surface → see the thing → edit the thing → save/back → continue playing
```

The desired Author-tool flow is:

```text
open Author tool → manage authorable definitions directly → nest into the owning editor as needed
```

Neither flow should become:

```text
see the thing → remember its name → back out → find its owner tool → search again → edit
```

## 6. Create through the owner too

The same ownership rule applies when a referenced resource does not exist yet.

A reference surface may offer `+ Create`, but creation should launch the owning feature's creation task rather than implement a local mini-editor. When the child saves, its new stable identity should return to the suspended parent and become selected there when appropriate.

This is how reusable resource fields remain generic while feature-specific creation remains feature-owned.

## 7. Do not add forwarding panels with no decision

Nesting should represent real work, not navigation ceremony.

If a route or panel exists only to say "open the editor over there," remove that forwarding layer and open the owning task directly.

A nested task is justified when it has its own draft/lifecycle, when the author must make a meaningful choice, or when it is an independently suspendable unit of work. It is not justified merely to mirror internal object hierarchy.

This follows the Author UI grammar rule that implementation depth should not become visual depth.

## 8. Cross-feature access should use contracts, not editor imports

A referencing feature should not import another feature's editor implementation and embed it directly.

Instead, use a shared Author resource/task contract, feature-contributed route/provider, contextual Author bridge, or another explicit composition boundary that says, in effect:

> edit resource X using whoever owns X in this installation

This preserves replaceability. If the State editor is replaced later, Status references should continue to open the State-owned editor through the same contract rather than requiring duplicate Status changes to a copied editor.

Every installed feature that owns authorable resources should expose enough generic resource/capability information for other installed features to reach those owners without knowing their editor internals. “Every feature can reach every other” means composable contracts and routes, not mutual implementation imports.

## 9. One save authority

Because there is one owning editor, there should also be one authoritative edit/save path for the resource.

Reference surfaces may stage their own parent changes, but they should not partially mutate the referenced resource while its owning task has an unsaved draft.

If the child resource has an independent lifecycle, save it through the child task. If the nested control is truly part of the parent's transaction, keep it staged in the parent rather than publishing an unrelated project mutation early.

The author should always be able to answer: **which task owns the change I am making?**

Runtime test controls are different from project editing. A control that deliberately changes only the current playthrough may live beside a resource reference, but it should be labeled as run/test behavior and should not also write the durable resource definition.

## 10. Modularity test

Before adding or changing an Author surface, identify each authorable thing it displays and run this test:

1. **Owner:** Which feature owns this resource's durable definition?
2. **Canonical editor:** Is there exactly one editor/task responsible for editing it?
3. **Reachability:** Can the author enter that editor directly from this surface?
4. **Nesting:** Does doing so preserve the current parent task/workspace rather than abandoning it?
5. **No duplication:** Did this surface avoid recreating the owner's fields, validation, or save behavior?
6. **Mode boundary:** Is an Author tool author-facing rather than a duplicate player preview?
7. **Natural action:** Does adding Author editability preserve the surface's ordinary play/navigation action?
8. **Provenance:** If this is rendered during play, does the runtime still know which authored definition produced it?
9. **Creation:** If the resource can be created here, does creation use the same owner?
10. **Responsive parity:** Do mobile and desktop invoke the same task and persistence path?
11. **Replaceability:** Could the owning feature replace its editor without every referencing feature needing its own editor rewrite?

If the answer to reachability is no, the Author experience is incomplete. If the answer to duplication, mode boundary, provenance, or replaceability is no, the modular boundary is incomplete.

## Examples

### Player Status

`PLAYER STATUS` is a useful direct Author tool because authors often want to work specifically on what the game exposes as Status. The Author tool should therefore manage player groups and values directly and let every group/value enter its State-owned editor. It is **not** a literal player Status preview.

The literal player Status remains the real player workspace. When Author mode is active over that workspace, the group and each authorable entry should be able to open those same State-owned editors directly without losing the group's normal player navigation behavior.

### Inventory

`INVENTORY` is likewise a useful direct Author tool, but it should manage item definitions, Body Types, slots, equipment rules, and related configuration rather than duplicate the player's inventory grid.

The live player Inventory remains the real player surface. In Author mode, item/body affordances there open the same Inventory-owned Item or Body tasks used from Author Tools while the normal player select/use/equip interactions remain available.

### References inside another editor

A Response that names a Character, an Item rule that names a Media asset, or a condition that names a State variable should let the author choose/create/edit that referenced resource through its owning feature while the parent draft remains suspended.

## Review invariant

For Author-mode work, treat this as a core architectural invariant:

> **Ownership determines where editing logic lives; context determines where that editor can be entered.**

A modular engine should have many entry points into a small number of canonical, feature-owned editors—not many copies of those editors.