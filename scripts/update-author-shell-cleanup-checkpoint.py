from pathlib import Path

path = Path("docs/author-ux-integration-refactor-plan.md")
text = path.read_text()

replacements = {
'''- [x] Duplicate Structure task frame/header removed; shared Author shell owns task chrome.
- [ ] Remaining unrestricted renderer: **Interaction editor only**.
''': '''- [x] Duplicate Structure task frame/header removed; shared Author shell owns task chrome.
- [x] Interaction editor duplicate outer frame and task-level Back removed; shared task navigation owns Back/X while `[‹ INPUT]` remains internal response/settings navigation.
- [ ] Remaining unrestricted renderer: **Interaction editor only**; its draft/validation/save lifecycle is still feature-owned and should not be disguised as a giant structured `custom` block.
''',
'''- [x] Migrated legacy `assets` and `synth` branches physically removed rather than left unreachable.
- [ ] Remaining unrestricted renderer: **actual Media asset editor, vector editor, and synth editor only**.
''': '''- [x] Migrated legacy `assets` and `synth` branches physically removed rather than left unreachable.
- [x] File Media, Vector, and Synth editors no longer draw duplicate Author task frames/titles or task-exit buttons; shared Author owns task navigation while editor-specific Save/Play/Export/Delete/Reset remain feature-owned.
- [x] Obsolete `SynthPanel` list component and its dead list/back CSS removed after branch-native proof that the structured Synth library is the only list owner.
- [ ] Remaining unrestricted renderer: **actual Media asset editor, vector editor, and synth editor only**; their specialized draft/content lifecycles remain genuine migration boundaries.
''',
'''- full Player Command structured migration and removal of Commands from the legacy Author exception list.
''': '''- full Player Command structured migration and removal of Commands from the legacy Author exception list;
- Narrative Interaction duplicate task-chrome cleanup;
- Media specialized-editor task-chrome cleanup and deletion of the superseded Synth list component.
''',
'''- open Story Structure and verify search/path/legend/node/interaction editing still work;
- open Media Assets and Synth Sounds and verify their browser/list behavior still opens the same canonical editors;
''': '''- open Story Structure and verify search/path/legend/node/interaction editing still work;
- open an Interaction as a nested task and confirm shared Author is the only task-level Back while `[‹ INPUT]` still navigates from Response/Input Settings to the interaction overview;
- open Media Assets and Synth Sounds and verify their browser/list behavior still opens the same canonical editors;
- open File Media, Vector, and Synth editors and confirm shared task Back/X replaces their old Close/Cancel/frame while Save/Play/Export/Delete/Reset still work;
''',
'''- ahead: **100 commits** before this checkpoint staging update
- behind: **0 commits**
- current pre-checkpoint source head: `09974df2aa978ae41b7baaaa7e3609f2430cc4f2` (`refactor: structure player command editor`).
''': '''- ahead: **110 commits** before this checkpoint staging update
- behind: **0 commits**
- current pre-checkpoint source head: `7b3d87519df674450c06cc3a3fa76fd8ccb5e6ce` (`ux: remove duplicate media task chrome`).
''',
'''### 2026-09-06 — Narrative runtime ownership extraction
''': '''### 2026-09-06 — remaining legacy editor shell cleanup

- Removed the Interaction editor's redundant outer Author frame and task-level Back. The shared task stack is now the only Author-task Back/X surface; the editor's `[‹ INPUT]` remains correctly scoped to its internal response/settings navigation.
- Removed duplicate outer frames/titles and visible Close/Cancel task-exit controls from File Media and Vector editors; Synth received the same outer-frame cleanup.
- Kept Media `onCancel` callbacks only as private lifecycle completion hooks after successful delete/reset, not as an alternate Author navigation path.
- Deleted the obsolete `SynthPanel` list component and its list/back CSS after asserting no component-symbol consumers remain; the structured Synth library is the single list owner.
- Both cleanup slices passed full `npm run verify`. These changes deliberately do **not** remove Narrative or Media from the legacy exception list because their specialized draft/save internals have not yet moved into the shared structured controller.

### 2026-09-06 — Narrative runtime ownership extraction
''',
'''4. choose the next remaining legacy Author editor by ownership boundary: Narrative Interaction versus Media asset/vector/synth; do not wrap either in a giant `custom` block merely to remove an exception id;
5. re-audit remaining direct Narrative imports in App and decide whether the current `executeInteraction` composition-root call is an acceptable boundary before another runtime extraction;
''': '''4. for Narrative Interaction or Media specialized editors, migrate only by moving real draft/save lifecycle into the shared structured controller; do not wrap the existing stateful editor wholesale as `custom` merely to remove an exception id;
5. re-audit remaining direct Narrative imports in App and decide whether the current `executeInteraction` composition-root call is an acceptable boundary before another runtime extraction;
''',
}

for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one plan fragment: {old[:100]!r}")
    text = text.replace(old, new)

path.write_text(text)
print("Author shell cleanup checkpoint updated")
