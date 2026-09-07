from pathlib import Path

# File Media editor: shared Author owns task exit/frame; keep onCancel only for successful reset/delete lifecycle.
asset_path = Path("src/features/media/author/MediaAssetEditor.tsx")
asset = asset_path.read_text()
old_root = '''  return <section className="author-panel author-panel-frame media-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>{kind === "audio" ? "SOUND" : "IMAGE"} FILE · {draft?.name ?? "REPOSITORY"}</span></header>
'''
new_root = '''  return <section className="media-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
'''
if asset.count(old_root) != 1:
    raise SystemExit("Expected one framed MediaAssetEditor root/header")
asset = asset.replace(old_root, new_root)
old_close = '      <button type="button" onClick={onCancel}>[CLOSE]</button>\n'
if asset.count(old_close) != 1:
    raise SystemExit("Expected one MediaAssetEditor CLOSE button")
asset = asset.replace(old_close, '')
asset_path.write_text(asset)

# Vector editor: same task-chrome cleanup; onCancel remains for successful delete/reset.
vector_path = Path("src/features/media/author/VectorAssetEditor.tsx")
vector = vector_path.read_text()
old_root = '''  return <section className="author-panel author-panel-frame vector-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>VECTOR ASSET · {name || "NEW"}</span></header>
'''
new_root = '''  return <section className="vector-asset-editor" onPointerDown={(event) => event.stopPropagation()}>
'''
if vector.count(old_root) != 1:
    raise SystemExit("Expected one framed VectorAssetEditor root/header")
vector = vector.replace(old_root, new_root)
old_cancel = '      <button type="button" onClick={onCancel}>[CANCEL]</button>\n'
if vector.count(old_cancel) != 1:
    raise SystemExit("Expected one VectorAssetEditor CANCEL button")
vector = vector.replace(old_cancel, '')
vector_path.write_text(vector)

# Synth list is superseded by the structured Synth library. Keep only the canonical specialized SynthEditor.
synth_path = Path("src/features/media/author/SynthPanel.tsx")
synth = synth_path.read_text()
list_start = synth.find('/** List workspace. Editing a sound is a child Author route rather than hidden local navigation. */')
editor_start = synth.find('export function SynthEditor(')
if list_start < 0 or editor_start < 0 or editor_start <= list_start:
    raise SystemExit("Could not locate obsolete SynthPanel list component")
obsolete = synth[list_start:editor_start]
if 'export function SynthPanel' not in obsolete:
    raise SystemExit("SynthPanel definition not found in expected obsolete block")
synth = synth[:list_start] + synth[editor_start:]
old_root = '''  return <section className="author-panel author-panel-frame synth-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>SOUND · {draft.label || "NEW"}</span></header>
'''
new_root = '''  return <section className="synth-panel" onPointerDown={(event) => event.stopPropagation()}>
'''
if synth.count(old_root) != 1:
    raise SystemExit("Expected one framed SynthEditor root/header")
synth = synth.replace(old_root, new_root)
if 'export function SynthPanel' in synth:
    raise SystemExit("Obsolete SynthPanel list component remains")
synth_path.write_text(synth)

# Prove no source file still references the removed SynthPanel component symbol.
for candidate in Path('src').rglob('*'):
    if candidate.suffix not in {'.ts', '.tsx'} or candidate == synth_path:
        continue
    source = candidate.read_text()
    symbol_uses = ('<SynthPanel', 'SynthPanel(', '{ SynthPanel', ', SynthPanel', 'SynthPanel,')
    if any(token in source for token in symbol_uses):
        raise SystemExit(f"Removed SynthPanel component is still referenced by {candidate}")

css_path = Path("src/features/media/author/mediaAuthor.css")
css = css_path.read_text()
old_controls = '''.synth-create,
.synth-back {
  width: fit-content;
  min-height: 2.5em;
  padding: .35em .5em !important;
}

.synth-back { color: var(--dos-muted) !important; }

'''
if css.count(old_controls) != 1:
    raise SystemExit("Expected obsolete synth list/back control CSS")
css = css.replace(old_controls, '')
old_list = '.synth-definition-list button { min-height: 3em; }\n'
if css.count(old_list) != 1:
    raise SystemExit("Expected obsolete synth definition list CSS")
css = css.replace(old_list, '')
old_mobile = '''  .synth-create,
  .synth-back,
  .synth-definition-list button { min-height: 2.75em; font-size: max(16px, 1em); }
'''
if css.count(old_mobile) != 1:
    raise SystemExit("Expected obsolete synth list mobile CSS")
css = css.replace(old_mobile, '')
for token in ['.synth-create', '.synth-back', '.synth-definition-list']:
    if token in css:
        raise SystemExit(f"Dead media CSS remains: {token}")
css_path.write_text(css)

print("Media shell cleanup staged successfully")
