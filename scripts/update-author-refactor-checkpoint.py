from pathlib import Path

path = Path("docs/author-ux-integration-refactor-plan.md")
text = path.read_text()

replacements = {
'''- [x] Per-target Reference Source editor moved to structured Author grammar using the same Commands-owned `project.settings` persistence path; old editor branch and CSS were physically removed.
- [ ] Remaining unrestricted renderer: **Player Command editor only**.

#### Legacy exception list

`LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` still contains `narrative`, `media`, and `commands` because each still owns at least one real unrestricted editor. Do not remove an id until its last unrestricted path is genuinely gone.
''': '''- [x] Per-target Reference Source editor moved to structured Author grammar using the same Commands-owned `project.settings` persistence path; old editor branch and CSS were physically removed.
- [x] Player Command editor moved to structured Author grammar while retaining authored text/effects as specialized feature-owned controls.
- [x] Shared structured save boundary now supports prerequisite saves without completing a resource task, preserving save-before-nested-target editing without a Commands-only mutation path.
- [x] Commands `renderWorkspace` removed and `commands` removed from `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`.

#### Legacy exception list

`LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` now contains only `narrative` and `media`, each because it still owns real unrestricted canonical editors. Do not remove an id until its last unrestricted path is genuinely gone.
''',
'''- branch-native audit and removal of the obsolete `custom` `resource-picker` role.
''': '''- branch-native audit and removal of the obsolete `custom` `resource-picker` role;
- full Player Command structured migration and removal of Commands from the legacy Author exception list.
''',
'''- edit a Player Command through its remaining canonical editor and edit a per-target Reference Source through the structured task;
''': '''- edit/create/delete a Player Command through the structured task, including response speaker/text/effects and target-operation setup;
- from a dirty/new target-operation command, open a target owner's behavior editor and confirm the command saves first without returning from its resource task;
- edit a per-target Reference Source through the structured task;
''',
'''- ahead: **87 commits** before this documentation update
- behind: **0 commits**
- current pre-documentation head: `2d484f5d682a2b05688c790e67801d6767f7d454` (`refactor: use narrative execution presentation contract`).
''': '''- ahead: **100 commits** before this checkpoint staging update
- behind: **0 commits**
- current pre-checkpoint source head: `09974df2aa978ae41b7baaaa7e3609f2430cc4f2` (`refactor: structure player command editor`).
''',
'''### 2026-09-06 — Narrative runtime ownership extraction
''': '''### 2026-09-06 — complete Commands structured migration

- Migrated the Player Command editor to the shared data-first Author task system.
- Kept ordinary command controls in the semantic grammar and retained Authored Text / Outcome Effects only as specialized feature-owned controls inside the shared shell.
- Added a generic `saveCurrentDraft({ completeTask: false })` structured-task capability so a parent can satisfy a nested editor prerequisite through its one canonical save boundary without accidentally completing/returning a resource task.
- Preserved Player Command validation, automatic target-source enablement, create/edit resource completion, delete confirmation, and save-before-target-owner nesting.
- Removed Commands' unrestricted `renderWorkspace` contribution and removed `commands` from the legacy exception list; only Narrative and Media remain.
- The migration passed full `npm run verify`; an independent normal branch verification is triggered by this checkpoint staging commit.

### 2026-09-06 — Narrative runtime ownership extraction
''',
'''4. re-audit remaining direct Narrative imports in App after the three runtime slices and decide whether a higher-level interaction contribution is warranted or whether the current call is an acceptable composition-root installation;
5. remaining Commands Author migration target: Player Command editor, now the only unrestricted Commands workspace; migrate it only if the structured grammar can preserve its specialized text/effects/target setup without duplicating persistence;
6. do not begin the broader Session lifecycle move until the remaining lower-risk Author/runtime slices are stable; Session crosses saved-game compatibility and autosave semantics;
7. after every App/runtime extraction, re-audit direct feature imports/branches and require a fresh full verification checkpoint;
8. before merge: run final full verification, perform the manual Author acceptance route, and **delete `.github/workflows/verify-author-ux-refactor.yml`**;
9. update this document before ending any session where meaningful work occurred.
''': '''4. choose the next remaining legacy Author editor by ownership boundary: Narrative Interaction versus Media asset/vector/synth; do not wrap either in a giant `custom` block merely to remove an exception id;
5. re-audit remaining direct Narrative imports in App and decide whether the current `executeInteraction` composition-root call is an acceptable boundary before another runtime extraction;
6. do not begin the broader Session lifecycle move until the remaining lower-risk Author/runtime slices are stable; Session crosses saved-game compatibility and autosave semantics;
7. after every App/runtime extraction, re-audit direct feature imports/branches and require a fresh full verification checkpoint;
8. before merge: run final full verification, perform the manual Author acceptance route, and **delete `.github/workflows/verify-author-ux-refactor.yml`**;
9. update this document before ending any session where meaningful work occurred.
''',
}

for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one plan fragment: {old[:100]!r}")
    text = text.replace(old, new)

path.write_text(text)
print("Author refactor checkpoint updated")
