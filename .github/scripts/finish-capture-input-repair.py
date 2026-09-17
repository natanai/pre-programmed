from pathlib import Path

path = Path("src/features/narrative/author/InteractionEditor.tsx")
text = path.read_text()

import_old = 'import { ALWAYS, type Condition } from "../../../engine/rules/model";\n'
import_new = import_old + 'import { PLAYER_INPUT_BINDING } from "../../../engine/rules/runtimeBindings";\n'
if import_new not in text:
    if import_old not in text:
        raise SystemExit("rules/model import anchor not found")
    text = text.replace(import_old, import_new, 1)

old = '''      <EffectsEditor
        effects={capture.effects}
        snapshot={snapshot}
        onChange={(effects) => onChange((current) => current.inputCapture
'''
new = '''      <EffectsEditor
        effects={capture.effects}
        snapshot={snapshot}
        authoringContext={{ preferredRuntimeBindingKey: PLAYER_INPUT_BINDING }}
        onChange={(effects) => onChange((current) => current.inputCapture
'''
if new not in text:
    if old not in text:
        raise SystemExit("capture EffectsEditor anchor not found")
    text = text.replace(old, new, 1)

path.write_text(text)
