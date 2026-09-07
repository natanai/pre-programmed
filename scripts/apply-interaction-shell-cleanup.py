from pathlib import Path

manifest_path = Path("src/features/narrative/author/manifest.tsx")
manifest = manifest_path.read_text()
old_cancel = '          onCancel={context.hasParentTask ? context.leaveCurrentTask : undefined}\n'
if manifest.count(old_cancel) != 1:
    raise SystemExit("Expected one InteractionEditor task-level onCancel wiring")
manifest = manifest.replace(old_cancel, '')
manifest_path.write_text(manifest)

editor_path = Path("src/features/narrative/author/InteractionEditor.tsx")
editor = editor_path.read_text()
old_prop = '''  onSave,
  onCancel,
  onDirtyChange,
'''
new_prop = '''  onSave,
  onDirtyChange,
'''
if editor.count(old_prop) != 1:
    raise SystemExit("Expected one onCancel destructuring entry")
editor = editor.replace(old_prop, new_prop)
old_type = '''  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onCancel?: () => void;
  onDirtyChange: (dirty: boolean) => void;
'''
new_type = '''  onSave: (operations: MutationOperation[], description: string) => Promise<AuthorPersistResult>;
  onDirtyChange: (dirty: boolean) => void;
'''
if editor.count(old_type) != 1:
    raise SystemExit("Expected one onCancel prop type")
editor = editor.replace(old_type, new_type)
old_section = '<section className="author-panel author-panel-frame interaction-editor-panel guided-interaction-editor" onPointerDown={(event) => event.stopPropagation()}>'
new_section = '<section className="interaction-editor-panel guided-interaction-editor" onPointerDown={(event) => event.stopPropagation()}>'
if editor.count(old_section) != 1:
    raise SystemExit("Expected one framed InteractionEditor root")
editor = editor.replace(old_section, new_section)
old_back = '      {onCancel ? <button type="button" onClick={onCancel}>[BACK]</button> : null}\n'
if editor.count(old_back) != 1:
    raise SystemExit("Expected one duplicate InteractionEditor footer Back")
editor = editor.replace(old_back, '')
if 'onCancel' in editor:
    raise SystemExit("InteractionEditor onCancel residue remains")
editor_path.write_text(editor)

css_path = Path("src/features/narrative/author/interactionEditor.css")
css = css_path.read_text()
old_root = '''.guided-interaction-editor {
  width: 100%;
  max-width: none;
}
'''
new_root = '''.guided-interaction-editor {
  width: 100%;
  max-width: none;
  min-width: 0;
  border: 0;
  background: transparent;
}
'''
if css.count(old_root) != 1:
    raise SystemExit("Expected one guided interaction root style")
css = css.replace(old_root, new_root)
css_path.write_text(css)

print("Interaction shell cleanup staged successfully")
