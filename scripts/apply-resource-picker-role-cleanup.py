from pathlib import Path

radix_path = Path("src/features/radix/author/workspaces.tsx")
radix = radix_path.read_text()
old_radix = '{ type: "custom", id: "radix-synth", role: "resource-picker", content: <ReferenceField kind="synth-sound" value={draft.synthId} onChange={(synthId) => setDraft({ ...draft, synthId })} placeholder="Default triangle tone" /> },'
new_radix = '{ type: "resource", id: "radix-synth", label: "SYNTH SOUND", kind: "synth-sound", value: draft.synthId, onChange: (synthId) => setDraft({ ...draft, synthId }), placeholder: "Default triangle tone" },'
if radix.count(old_radix) != 1:
    raise SystemExit("Expected one Radix custom synth resource picker")
radix = radix.replace(old_radix, new_radix)
if 'role: "resource-picker"' in radix:
    raise SystemExit("Radix resource-picker role remains")
radix_path.write_text(radix)

node_path = Path("src/features/narrative/author/nodeWorkspace.tsx")
node = node_path.read_text()
old_node_role = '          role: "resource-picker",\n'
new_node_role = '          role: "specialized-control",\n'
if node.count(old_node_role) != 1:
    raise SystemExit("Expected one Narrative node context resource-picker role")
node = node.replace(old_node_role, new_node_role)
if 'role: "resource-picker"' in node:
    raise SystemExit("Narrative node resource-picker role remains")
node_path.write_text(node)

types_path = Path("src/author/ui/types.ts")
types = types_path.read_text()
old_union = '  role: "specialized-control" | "resource-picker" | "ordered-list" | "rule-editor" | "preview" | "results";\n'
new_union = '  role: "specialized-control" | "ordered-list" | "rule-editor" | "preview" | "results";\n'
if types.count(old_union) != 1:
    raise SystemExit("Expected Author custom role union with resource-picker")
types = types.replace(old_union, new_union)
if 'resource-picker' in types:
    raise SystemExit("resource-picker remains in Author UI types")
types_path.write_text(types)

plan_path = Path("docs/author-ux-integration-refactor-plan.md")
plan = plan_path.read_text()
replacements = {
    '- [ ] Audit current branch for any remaining ordinary `custom` resource-picker escape hatches before removing that legacy role from the grammar.\n': '- [x] Audited the live branch for `custom` resource-picker escape hatches; migrated the ordinary Radix synth selector to semantic `resource`, reclassified Narrative Node context as a genuine composite `specialized-control`, and removed the `resource-picker` role from the grammar.\n',
    '- [x] Deleted the four now-unreachable legacy route components, their old renderer branches, the helper used only by them, and migrated list-route CSS instead of leaving prototype UI dormant.\n- [ ] Remaining unrestricted renderer: **Player Command editor and per-target Reference Source editor only**.\n': '- [x] Deleted the four now-unreachable legacy route components, their old renderer branches, the helper used only by them, and migrated list-route CSS instead of leaving prototype UI dormant.\n- [x] Per-target Reference Source editor moved to structured Author grammar using the same Commands-owned `project.settings` persistence path; old editor branch and CSS were physically removed.\n- [ ] Remaining unrestricted renderer: **Player Command editor only**.\n',
    '- edit a Player Command and a per-target Reference Source through their canonical remaining editors;\n': '- edit a Player Command through its remaining canonical editor and edit a per-target Reference Source through the structured task;\n',
    '- removal of App\'s duplicate `interactionOutcomeProse` interpretation.\n': '- removal of App\'s duplicate `interactionOutcomeProse` interpretation;\n- Commands per-target Reference Source structured migration using shared Commands persistence;\n- branch-native audit and removal of the obsolete `custom` `resource-picker` role.\n',
    '5. audit current branch for any remaining ordinary `custom` resource-picker escape hatches before deleting that legacy custom role;\n6. remaining Commands Author migration target: per-target Reference Source editor first if it can be moved to structured grammar without duplicating persistence; Player Command editor remains the more complex final Commands legacy surface;\n7. do not begin the broader Session lifecycle move until the remaining lower-risk Author/runtime slices are stable; Session crosses saved-game compatibility and autosave semantics;\n8. after every App/runtime extraction, re-audit direct feature imports/branches and require a fresh full verification checkpoint;\n9. before merge: run final full verification, perform the manual Author acceptance route, and **delete `.github/workflows/verify-author-ux-refactor.yml`**;\n10. update this document before ending any session where meaningful work occurred.\n': '5. remaining Commands Author migration target: Player Command editor, now the only unrestricted Commands workspace; migrate it only if the structured grammar can preserve its specialized text/effects/target setup without duplicating persistence;\n6. do not begin the broader Session lifecycle move until the remaining lower-risk Author/runtime slices are stable; Session crosses saved-game compatibility and autosave semantics;\n7. after every App/runtime extraction, re-audit direct feature imports/branches and require a fresh full verification checkpoint;\n8. before merge: run final full verification, perform the manual Author acceptance route, and **delete `.github/workflows/verify-author-ux-refactor.yml`**;\n9. update this document before ending any session where meaningful work occurred.\n',
}
for old, new in replacements.items():
    if plan.count(old) != 1:
        raise SystemExit(f"Expected one plan fragment: {old[:80]!r}")
    plan = plan.replace(old, new)

insert_marker = '''### 2026-09-06 — Narrative runtime ownership extraction
'''
if plan.count(insert_marker) != 1:
    raise SystemExit("Expected Narrative runtime change-log marker")
new_section = '''### 2026-09-06 — Commands Reference Source + resource-picker cleanup

- Moved per-target Reference Source editing into structured Author grammar using shared toggles, fields, sections, and contextual actions.
- Centralized Commands author settings persistence helpers so the structured Reference Source task and remaining Player Command editor share one mutation path.
- Removed the old Reference Source legacy renderer branch and its route-specific CSS rather than leaving it unreachable.
- Branch-native audit found only two `custom` `resource-picker` roles: Radix synth selection and the composite Narrative Node context strip.
- Migrated Radix synth selection to semantic `resource`; retained Node context as a specialized composite because it owns Set / Continue / Clear context semantics rather than acting as an ordinary picker.
- Removed `resource-picker` from the shared `AuthorUiCustom` role union so new ordinary resource fields cannot regress to that escape hatch.

'''
plan = plan.replace(insert_marker, new_section + insert_marker)
plan_path.write_text(plan)

for path in [radix_path, node_path, types_path]:
    if 'role: "resource-picker"' in path.read_text():
        raise SystemExit(f"resource-picker role remains in {path}")

print("Author resource-picker role cleanup staged successfully")
