from pathlib import Path


def replace_once(path: Path, old: str, new: str):
    text = path.read_text()
    count = text.count(old)
    assert count == 1, f"{path}: expected one match, found {count}: {old[:100]!r}"
    path.write_text(text.replace(old, new, 1))

plan = Path("docs/author-ux-integration-refactor-plan.md")
readme = Path("README.md")
interaction = Path("src/features/narrative/author/InteractionEditor.tsx")

replace_once(
    plan,
    "8. No new feature should enter `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS`.\n",
    "8. Unrestricted feature-level workspace rendering is not part of the Author feature contract.\n",
)

replace_once(
    plan,
    "## Protected semantics\n",
    "## Current merge-readiness status\n\n"
    "- All feature Author workspaces are now data-first/structured.\n"
    "- `renderWorkspace` and `LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` have been removed from the Author architecture entirely.\n"
    "- Narrative Interaction, Media File/Vector/Synth, Commands, Project, State, Inventory, World, and Radix all use the shared workspace lifecycle.\n"
    "- Specialized controls remain feature-owned inside structured tasks; they do not own parallel durable save paths.\n"
    "- Radix and the selected Narrative presentation/runtime seams have been extracted from `App.tsx` in independently verified slices.\n"
    "- Session lifecycle consolidation remains a separate follow-up architecture project and is not a merge blocker for this Author UX branch.\n"
    "- Remaining merge gates: final branch-wide verification, real mobile/desktop acceptance, remove the temporary branch verifier, and confirm the branch is still 0 behind `main`.\n\n"
    "## Protected semantics\n",
)

replace_once(
    plan,
    "- [x] Interaction editor duplicate outer frame and task-level Back removed; shared task navigation owns Back/X while `[‹ INPUT]` remains internal response/settings navigation.\n"
    "- [ ] Remaining unrestricted renderer: **Interaction editor only**; its draft/validation/save lifecycle is still feature-owned and should not be disguised as a giant structured `custom` block.\n",
    "- [x] Interaction editor duplicate outer frame and task-level Back removed; shared task navigation owns Back/X while `[‹ INPUT]` remains internal response/settings navigation.\n"
    "- [x] Interaction normalization, validation, persisted-shape construction, and save descriptions centralized in Narrative-owned authoring semantics.\n"
    "- [x] Interaction response/settings UI split into a controlled specialized composer with no persistence or dirty-baseline ownership.\n"
    "- [x] Interaction resource draft, dirty state, validation, Save/Delete, nested completion, and persistence moved to `interactionWorkspace`.\n"
    "- [x] Narrative `renderWorkspace` and its legacy self-owning Interaction wrapper physically removed after the structured live route passed full verification.\n",
)

replace_once(
    plan,
    "- [ ] Remaining unrestricted renderer: **actual Media asset editor, vector editor, and synth editor only**; their specialized draft/content lifecycles remain genuine migration boundaries.\n",
    "- [x] File Media metadata lifecycle moved to a structured workspace; vector-grid images route directly to their owning Vector workspace.\n"
    "- [x] Synth durable draft/save lifecycle moved to a structured workspace while the sequencer remains a specialized controlled interaction.\n"
    "- [x] Vector durable draft/save lifecycle moved to a structured workspace with async canonical-draft adoption; canvas tools/undo/redo/zoom remain local transient interaction state.\n"
    "- [x] Media `renderWorkspace` removed and superseded File/Vector/Synth legacy editor wrappers physically deleted.\n",
)

replace_once(
    plan,
    "#### Legacy exception list\n\n"
    "`LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS` now contains only `narrative` and `media`, each because it still owns real unrestricted canonical editors. Do not remove an id until its last unrestricted path is genuinely gone.\n",
    "#### Legacy renderer removal\n\n"
    "- [x] Every feature workspace now enters through a structured workspace definition.\n"
    "- [x] The registry's unrestricted workspace fallback and legacy exception set were removed.\n"
    "- [x] `renderWorkspace` was removed from `AuthorFeatureManifest`, so unrestricted feature-level workspace rendering can no longer be reintroduced accidentally.\n",
)

replace_once(
    plan,
    "- [ ] Consolidate complete play-session lifecycle ownership under Session.\n",
    "- [ ] Consolidate complete play-session lifecycle ownership under Session. **Deferred follow-up; not a merge blocker for this branch.**\n",
)

replace_once(
    plan,
    "The workflow uses a concurrency group with `cancel-in-progress: true`; cancelled intermediate runs normally mean a newer commit superseded them, not that verification failed.\n",
    "The verifier intentionally has no single-run concurrency lock; a previously stuck GitHub runner should not block verification of a newer branch head.\n",
)

start = "## Current branch relationship\n"
end = "## Change log\n"
text = plan.read_text()
start_i = text.index(start)
end_i = text.index(end, start_i)
replacement = (
    "## Current branch relationship\n\n"
    "- Merge base remains the current `main` head from branch creation unless a later comparison says otherwise.\n"
    "- Acceptance audits during this branch have repeatedly shown **0 commits behind `main`**; re-check immediately before merge.\n"
    "- `App.tsx` remains net smaller than the branch-start `main` snapshot despite installing Radix and Narrative integration contracts.\n"
    "- No project mutation formats, durable persistence formats, Worker persistence, or gameplay save schema were changed by the Author workspace migrations or the isolated Radix/Narrative presentation extractions.\n"
    "- Temporary verification scaffolding must be deleted after the final real-device acceptance pass and before merge.\n\n"
)
plan.write_text(text[:start_i] + replacement + text[end_i:])

replace_once(
    readme,
    "### Synth authoring\n\nSynth sounds are stored as reusable synth definitions in project data. They are reconstructed by the browser's synth player; they are not rendered into uploaded audio blobs.\n",
    "### Synth authoring\n\n"
    "Synth sounds are stored as reusable synth definitions in project data. They are reconstructed by the browser's synth player; they are not rendered into uploaded audio blobs. Author mode provides lightweight system-sound palettes plus direct waveform and envelope-shape controls, while the same underlying recipe remains fully editable. Sequence steps use large touch-friendly pads, pitch can be scrubbed vertically, and less-common precision controls such as per-step volume and exact envelope values use progressive disclosure instead of occupying the primary mobile workflow.\n",
)

replace_once(
    interaction,
    'help: "Open the real Node editor. Saving that nested task returns here with the new Node linked.",',
    'help: "Create and link a new Node.",',
)

assert "LEGACY_AUTHOR_WORKSPACE_FEATURE_IDS now contains" not in plan.read_text()
assert "Remaining unrestricted renderer" not in plan.read_text()
