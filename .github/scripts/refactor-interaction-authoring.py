from pathlib import Path
import re

path = Path("src/features/narrative/author/InteractionEditor.tsx")
text = path.read_text()

old_import = 'import { createDraftInteraction, createDraftOutcome } from "../drafts";\n'
new_import = 'import { createDraftOutcome } from "../drafts";\n'
assert old_import in text
text = text.replace(old_import, new_import, 1)

old_validate_import = 'import { validateTextNotation } from "../textNotation";\n'
assert old_validate_import in text
text = text.replace(old_validate_import, '', 1)

anchor = 'import { AuthoredTextEditor, type AuthoredTextValue } from "./AuthoredTextEditor";\n'
assert anchor in text
helper_import = '''import {\n  interactionSaveDescription,\n  normalizeInteractionAuthorDraft,\n  prepareInteractionForSave,\n} from "./interactionAuthoring";\nexport { aliasesForUserInput } from "./interactionAuthoring";\n'''
text = text.replace(anchor, anchor + helper_import, 1)

pattern = re.compile(r'''export function aliasesForUserInput\(userInputText: string, aliases: string\[\]\) \{.*?\n\}\n\nfunction normalizedInteraction\(.*?\n\}\n\n''', re.S)
text, count = pattern.subn('', text, count=1)
assert count == 1, f"expected authoring helper block once, got {count}"

old_init = 'const [draft, setDraft] = useState(() => normalizedInteraction(initial, resolvedSourceNodeId, initialCommand, fallbackMode));'
assert old_init in text
text = text.replace(old_init, 'const [draft, setDraft] = useState(() => normalizeInteractionAuthorDraft(initial, resolvedSourceNodeId, initialCommand, fallbackMode));', 1)

save_start = text.index('  const save = async (): Promise<boolean> => {')
save_end_anchor = '\n\n  useEffect(() => {\n    if (!onRegisterSave) return;'
save_end = text.index(save_end_anchor, save_start)
new_save = '''  const save = async (): Promise<boolean> => {\n    const prepared = prepareInteractionForSave(draft, fallbackMode, snapshot);\n    if ("issue" in prepared) {\n      setError(prepared.issue.message);\n      setScreen(prepared.issue.outcomeId\n        ? { type: "response", outcomeId: prepared.issue.outcomeId }\n        : { type: "overview" });\n      return false;\n    }\n\n    setError("");\n    setSaving(true);\n    try {\n      const { interaction } = prepared;\n      const result = await onSave(\n        [{ type: "interaction.upsert", interaction }],\n        interactionSaveDescription(interaction, Boolean(initial), fallbackMode, snapshot),\n      );\n      if (result.status === "saved" || result.status === "queued") {\n        setDraft(interaction);\n        setNewOutcomeIds(new Set());\n        setSavedSignature(JSON.stringify(interaction));\n        return true;\n      }\n      return false;\n    } finally {\n      setSaving(false);\n    }\n  };'''
text = text[:save_start] + new_save + text[save_end:]

path.write_text(text)
