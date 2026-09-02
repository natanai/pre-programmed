# Current Architecture Directive

**Issued:** 2026-09-02 17:09 America/Chicago

Until explicitly superseded by the project owner, current development should follow this sequence:

1. Treat the shared Author task/runtime and data-first Author UI grammar as protected foundation. Do not fork mobile/desktop behavior or create a replacement Author framework.
2. Complete the current State/Inventory replacement area first. Replace unsuitable prototype feature foundations rather than patching them.
3. New/replaced feature authoring must use the structured `workspaces` contract and the existing nested Author task/resource-return system. Do not add new feature IDs to the legacy `renderWorkspace()` exception surface.
4. For the current replacement, separate generic game values, player-facing status presentation, possessions/inventory, and equipment/body-slot mechanics into clean feature ownership rather than retaining the old coupled State + Inventory model.
5. Migrate durable authored project data only where useful. Compatibility code should be one-way and temporary; delete superseded runtime/UI paths instead of maintaining parallel sources of truth.
6. After this area is complete, audit every remaining feature in `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` and migrate them onto the structured Author system, shrinking that exception list until it can be removed.
7. Tests, workflows, and documentation should describe and protect the current architecture, not preserve obsolete prototype behavior.

This directive is intentionally current rather than historical documentation. If the project owner changes direction, update or replace this file instead of accumulating conflicting plans.
