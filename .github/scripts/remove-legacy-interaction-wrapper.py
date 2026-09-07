from pathlib import Path
import re

path = Path("src/features/narrative/author/InteractionEditor.tsx")
text = path.read_text()
original = text

replacements = [
    (
        'import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";\n',
        'import { useMemo, useState, type Dispatch, type SetStateAction } from "react";\n',
    ),
    ('import type { AuthorPersistResult } from "../../../author/persistence/authorProjectPersistence";\n', ''),
    ('import type { AuthorWorkspaceSaveHandler } from "../../../author/features/types";\n', ''),
    (
        'import type {\n  MutationOperation,\n  PlayState,\n  ProjectSnapshot,\n} from "../../../engine/project/model";\n',
        'import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";\n',
    ),
    (
        'import {\n  interactionSaveDescription,\n  normalizeInteractionAuthorDraft,\n  prepareInteractionForSave,\n} from "./interactionAuthoring";\n',
        '',
    ),
]

for old, new in replacements:
    count = text.count(old)
    assert count == 1, f"expected exactly one match for replacement, found {count}: {old[:80]!r}"
    text = text.replace(old, new, 1)

pattern = re.compile(
    r'export function InteractionEditor\(\{[\s\S]*?\n\}\n\n(?=/\*\*\n \* Controlled specialized interaction composer\.)'
)
text, count = pattern.subn('', text, count=1)
assert count == 1, f"expected one legacy InteractionEditor wrapper, found {count}"

for old, new in [
    ('  onEditDestination,\n  footer,\n}: {\n', '  onEditDestination,\n}: {\n'),
    ('  onEditDestination?: (nodeId: string) => void;\n  footer?: ReactNode;\n}) {\n', '  onEditDestination?: (nodeId: string) => void;\n}) {\n'),
    ('\n    {footer ?? null}\n  </section>;\n', '\n  </section>;\n'),
]:
    count = text.count(old)
    assert count == 1, f"expected exactly one footer cleanup match, found {count}: {old[:80]!r}"
    text = text.replace(old, new, 1)

assert text != original
for forbidden in [
    'export function InteractionEditor(',
    'AuthorPersistResult',
    'AuthorWorkspaceSaveHandler',
    'MutationOperation',
    'normalizeInteractionAuthorDraft',
    'prepareInteractionForSave',
    'interactionSaveDescription',
    'ReactNode',
    'footer?:',
    '{footer ?? null}',
]:
    assert forbidden not in text, f"legacy wrapper residue remains: {forbidden}"

path.write_text(text)
