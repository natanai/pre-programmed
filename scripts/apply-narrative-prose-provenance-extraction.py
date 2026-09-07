from pathlib import Path

runtime_path = Path("src/features/narrative/runtime.ts")
runtime = runtime_path.read_text()

old_source = '  const source = authoredSource("interaction", interaction.id, { outcomeId: outcome.id });\n'
new_source = '  const effectSource = authoredSource("interaction", interaction.id, { outcomeId: outcome.id });\n'
if runtime.count(old_source) != 1:
    raise SystemExit("Expected one Interaction outcome source declaration")
runtime = runtime.replace(old_source, new_source)

old_event_return = '    return { ...next, source };\n'
# One occurrence belongs to node entry and must remain; the second is interaction events.
if runtime.count(old_event_return) != 2:
    raise SystemExit(f"Expected two event source returns, got {runtime.count(old_event_return)}")
first = runtime.find(old_event_return)
second = runtime.find(old_event_return, first + len(old_event_return))
runtime = runtime[:second] + runtime[second:].replace(old_event_return, '    return { ...next, source: effectSource };\n', 1)

old_return = '''  return {
    state,
    outcome,
    responseText: interpolateText(prose.narrationText, { snapshot, state }),
    responsePerformance: prose.narrationPerformance,
    dialogueText: interpolateText(prose.dialogueText, { snapshot, state }),
    dialoguePerformance: prose.dialoguePerformance,
    dialogueSpeakerId: sourceConversation?.characterId ?? outcome.speakerId ?? null,
    events: [...interactionEvents, ...entry.events],
    attempt,
    eventKey,
    source,
  };
'''
new_return = '''  const responseText = interpolateText(prose.narrationText, { snapshot, state });
  const dialogueText = interpolateText(prose.dialogueText, { snapshot, state });
  const presentationSource = responseText
    ? authoredSource("interaction", interaction.id, { outcomeId: outcome.id, section: "narration" })
    : dialogueText
      ? authoredSource("interaction", interaction.id, { outcomeId: outcome.id, section: "dialogue" })
      : effectSource;

  return {
    state,
    outcome,
    responseText,
    responsePerformance: prose.narrationPerformance,
    dialogueText,
    dialoguePerformance: prose.dialoguePerformance,
    dialogueSpeakerId: sourceConversation?.characterId ?? outcome.speakerId ?? null,
    events: [...interactionEvents, ...entry.events],
    attempt,
    eventKey,
    source: presentationSource,
  };
'''
if runtime.count(old_return) != 1:
    raise SystemExit("Expected one Interaction execution return block")
runtime = runtime.replace(old_return, new_return)
if 'return { ...next, source };' not in runtime:
    raise SystemExit("Node-entry event provenance was accidentally removed")
if 'source: effectSource' not in runtime:
    raise SystemExit("Interaction effect provenance was not preserved separately")
runtime_path.write_text(runtime)

app_path = Path("src/App.tsx")
app = app_path.read_text()
old_app = '''    let source = execution.source;
    if (source?.resourceKind === "interaction") {
      source = authoredSource("interaction", source.resourceId, {
        ...(source.focus ?? {}),
        section: beginsWithDialogue ? "dialogue" : "narration",
      });
    }
'''
if app.count(old_app) != 1:
    raise SystemExit("Expected one App interaction provenance branch")
app = app.replace(old_app, '')
old_set = '      setActiveSource(source);\n'
if app.count(old_set) != 1:
    raise SystemExit("Expected one App active runtime source setter")
app = app.replace(old_set, '      setActiveSource(execution.source);\n')
for forbidden in [
    'source?.resourceKind === "interaction"',
    'section: beginsWithDialogue ? "dialogue" : "narration"',
]:
    if forbidden in app:
        raise SystemExit(f"Narrative prose provenance knowledge remains in App: {forbidden}")
app_path.write_text(app)

print("Narrative prose provenance extraction staged successfully")
