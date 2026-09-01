# `src/game` compatibility facades

This directory is transitional architecture.

Feature and engine ownership is moving to `src/features/*` and `src/engine/*`. The remaining files here preserve older imports so that migration can happen incrementally instead of through a flag-day rewrite.

## Shrink-only rule

- Do **not** add a new system here.
- Do **not** make this directory the canonical owner of new feature behavior.
- Prefer adding/fixing behavior in the owning feature or engine module and re-exporting it here only when an older import still needs compatibility.
- When safely touching an existing facade, prefer reducing its implementation responsibility.
- Compatibility must move in one direction: toward eventual deletion, not toward becoming a second architecture.

See `docs/feature-boundaries.md` and `docs/modular-engine-roadmap.md` for the project-wide rule and deletion test.
