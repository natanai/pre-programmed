from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text()

old_import = 'import { interactionOutcomeProse } from "./features/narrative/interactionProse";\n'
if text.count(old_import) != 1:
    raise SystemExit("Expected one interactionOutcomeProse import")
text = text.replace(old_import, "")

old = '''    const execution = executeInteraction(snapshot, commandState, parsed.interaction);
    const responseProse = execution.outcome ? interactionOutcomeProse(execution.outcome) : null;
    presentRuntimeExecution(
      snapshot,
      execution,
      commandState,
      commandLineId,
      responseProse?.narrationPerformance ?? DEFAULT_TEXT_PERFORMANCE,
      null,
      responseProse?.dialoguePerformance ?? DEFAULT_TEXT_PERFORMANCE,
    );'''
new = '''    const execution = executeInteraction(snapshot, commandState, parsed.interaction);
    presentRuntimeExecution(
      snapshot,
      execution,
      commandState,
      commandLineId,
      execution.responsePerformance,
      null,
      execution.dialoguePerformance,
    );'''
if text.count(old) != 1:
    raise SystemExit("Expected one interaction execution presentation block")
text = text.replace(old, new)

for token in ["interactionOutcomeProse", "responseProse"]:
    if token in text:
        raise SystemExit(f"Duplicate Narrative outcome presentation logic remains in App: {token}")

path.write_text(text)
