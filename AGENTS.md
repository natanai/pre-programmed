# Pre-Programmed repository rules

These rules are architectural constraints, not suggestions.

1. **Playing is the primary interface.** Authoring augments the exact game being played; do not create a separate conventional editor as the primary workflow.
2. **Public mode is fictionally clean.** Node IDs, dead-end notation, diagnostics, edit affordances, asset paths, conditions, and author controls are author-only.
3. **The browser thinks; Cloudflare persists.** Per-keystroke search, parser matching, graph traversal, dead-end analysis, relationship notation, validation, and synth playback happen locally after synchronization. Never make a request per keystroke.
4. **Git owns files.** Application code, images, fonts, sprites, MP3s, and other binary/static assets live in this repository. Cloudflare stores references, not duplicate asset bytes.
5. **D1 owns mutable structured project state.** Nodes, interactions, conditions, effects, entities, synth recipes, revisions, bookmarks, saves, and releases belong in D1 once persistence is implemented.
6. **Derived browser indexes are not canonical.** IndexedDB is a working cache and offline queue; in-memory indexes are derived data.
7. **No Twine-style graph is required.** Prefer current-node context, compact notation, local cascading branch navigation, raw/searchable structure, and relative relationships.
8. **Response wording and destination are independent.** Multiple differently-worded interactions may link to one destination.
9. **Author text entry is live local search.** Connection-capable fields search on every keystroke in a maximum roughly two-row result strip; selecting a result links without replacing authored wording.
10. **Mobile and desktop are peers.** Every essential author operation must work by touch and by pointer/keyboard; do not ship a desktop-only author feature.
11. **Do not hard-code story copy into presentation components.** Canonical story text belongs in game data, including the opening `you are born` node.
12. **Repository assets used by a public release are immutable by path.** Replace a released asset by adding a new path; do not overwrite the old path in place.
13. **No AI is required for parser semantics.** The player parser is deterministic and author-inspectable.
14. **Do not introduce R2, Durable Objects, WebSockets, collaboration, or a second persistence layer without an actual requirement.** Initial backend target is Worker + D1.
15. **Branch workflow.** Feature work belongs on branches and should be reviewed/merged when ready rather than using main as a scratchpad.

## Opening invariant

The first player-visible text is exactly lowercase, without punctuation:

`you are born`

Only after that text is rendered may the interactive Universe-drive prompt appear:

`U:\>` followed by a blinking underscore-style cursor.
