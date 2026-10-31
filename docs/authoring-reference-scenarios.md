# Two reference scenarios for play-while-authoring

These are **manual, playable product scenarios**, not automated test suites, exhaustive menus, new game templates, feature specifications, or GitHub Actions. They describe what two different authors actually want to make using the **same live Player surface and shared Author task system**. Keep the scenarios small enough to run in a disposable project without introducing special-case mechanics for either genre.

**Primary quality question:** When an author is doing something in the running game and discovers another resource is needed, can they create or edit that resource *from the current context*, then return to the exact unfinished task without losing their work or the playable context?

Click count is diagnostic, not the goal. A longer path that goes where expected and correctly returns is better than a short one that loses its parent task or forces a tool-index detour. Record discrepancies as ordinary product issues. Do not generate automated browser explorations, action workflows, sprawling evidence fixtures, or new feature-specific tests just to exercise these scenarios.

## Scenario A: A relationship-driven visual novel

**Player experience:** A stranger first appears as “Mysterious Voice.” The player converses with them, chooses what to say, gives a preferred nickname, influences a relationship value, and later learns the stranger's name. Portrait/background Media may accompany the dialogue if the current engine supports the desired presentation.

**Build while playing:**

1. From an actual running scene, create or edit the text and an accepted player reply in the existing Narrative system. Continue exercising the same real player input.
2. While authoring a dialogue response, select a speaker who does not exist yet. Enter **Create Character** in the canonical World owner, save, and return to the original speaker selection with the unfinished response preserved.
3. From that Character or response's actual resource reference, use the existing State-owned task to define a relationship variable or reveal flag; return through each nested parent. The relationship mechanic belongs to State, not a hardcoded dating system.
4. Author two conditional dialogue outcomes from the existing condition/effect vocabulary. Test them by playing from the actual terminal with distinct recorded state values, not by copying the player view into an Author panel.
5. Exercise the already-established aliases and input capture flow: display “Mysterious Voice” before a reveal; subsequently show the canonical name; let the player supply a nickname if supported by the existing response/capture/State contracts.
6. Attach or reference portrait/background/audio Media when available via the canonical Media owner. Record missing visual-novel presentation capabilities as product gaps; do not invent a second graphics or Media pipeline.
7. Return to play, revisit the conversation, and confirm that earlier choices affect the later text, name, and available replies as authored.

**What this reveals:** nested Character and State creation from Narrative, return-value handoff to the original field, conditional dialogue, authored identity/provenance, persistent relationship state, editing dialogue in place, and visual Media reachability.

## Scenario B: A continually expanding branching RPG

**Player experience:** Start at a village crossroads. Try a road that has not been authored, meet a stranger, encounter a locked gate, acquire a useful item, then return and see the path react to game state. New destinations can branch again; “infinitely branching” is an architectural aspiration for continuing to expand the graph, not a promise of literally infinite resources at runtime.

**Build while playing:**

1. From the actual terminal in a Node, enter an intended action such as `travel north`. While Author mode is active, make that input valid using the existing Narrative interaction and project Player Language mechanisms, retaining the ordinary player action. Do not hardcode `inspect`/`enter` or make an Author-only input interpreter.
2. From the response's destination control, create the missing destination **Node** using the canonical Narrative task. If this requires a **Location**, create it through the World owner from the exact referencing field, then return to the still-unfinished destination.
3. From the destination Node, introduce a new Character or interaction as needed, using its real owner without discarding the parent draft. Follow a Node in play independently of its Edit affordance.
4. Introduce a locked gate. Author its condition using existing State, and an item needed to pass using Inventory. A missing Item, State variable, or relevant Media asset should be create/editable from the actual requesting resource field, returning to that field after completion.
5. Set and read state through shared conditions/effects and existing Player Commands, not separate RPG quest logic. Verify one blocked outcome, one successful outcome, and a revisited location that responds to the updated run state.
6. Add another destination *while playing the new branch*, then return or backtrack using ordinary authored transitions. Existing Nodes and their links should remain editable and navigable without re-discovery in the top-level Tools index.

**What this reveals:** new input authoring in situ, Node/Location/Item/State/Media cross-resource nesting, canonical saved identity, live player-state continuity, valid conditional choices, link traversal, returning to prior places, and expanding without a genre-specific editor.

## Shared acceptance criteria (desktop and mobile)

For **each step in each scenario**, when the referenced control actually exists in the engine:

- A clicked action opens the owner/task it describes; missing or mislabeled capabilities are documented as gaps, not assumed to work.
- Existing selection, follow, and player actions remain available while Author mode adds editing.
- A missing dependent resource can be created in its own canonical editor from the place that needs it.
- Saving a child makes its stable reference available to the requesting field and returns to the correct parent; canceling returns without committing that child.
- The suspended parent retains its draft, scroll/context, and selected field across multiple nested levels. Back stays within tasks; the master X returns to the real running player surface.
- Completed content is persisted through the owning feature's normal save path and behaves as authored when played.
- Mobile and desktop use the same feature owner, tasks, actions and save semantics; layout may vary.
- An obstacle is logged with the actual starting screen, chosen control, observed destination and what was lost or inaccessible, not an imagined count of possible workflows.

**Scope discipline:** Use a tiny disposable project or authored test scene; stop at the first blocking product defect, repair the canonical implementation, and resume the same scenario. Prefer a reproducible manual reproduction plus one focused regression check if essential. Do **not** add GitHub Actions, duplicate player systems, test-only Author panels, specialized dating/RPG modes, or expanding click-tree enumerations as a substitute for working on the game.

Canonical design references: [Author resource ownership](author-resource-ownership.md), [Author UI grammar](author-ui-grammar.md), and [feature boundaries](feature-boundaries.md).
