from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text()

replacements = {
    'import { resolveActiveNodeConversationContext, resolveNodeConversationContext } from "./features/narrative/sceneContext";\n': '',
    'import { interpolateText } from "./features/narrative/interpolation";\n': '',
    'import { useNarrativePlayerSurface } from "./features/narrative/runtime/useNarrativePlayerSurface";\n': 'import { resolveNodeOpeningPresentation, useNarrativeContinuation } from "./features/narrative/runtime/presentation";\nimport { useNarrativePlayerSurface } from "./features/narrative/runtime/useNarrativePlayerSurface";\n',
}
for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f"Expected one App import match: {old}")
    text = text.replace(old, new)

old_context = '''  const activeNodePresentation = snapshot && activeNodeId
    ? snapshot.nodes.find((node) => node.id === activeNodeId) ?? null
    : null;
  const nodeDialoguePending = Boolean(
    activeNodePresentation
    && activeSource?.resourceKind === "node"
    && activeSource.resourceId === activeNodePresentation.id
    && activeSource.focus?.section === "narration"
    && activeNodePresentation.dialogueText?.trim(),
  );
  const activeInteractionPresentation = snapshot && activeSource?.resourceKind === "interaction"
    ? snapshot.interactions.find((interaction) => interaction.id === activeSource.resourceId) ?? null
    : null;
  const activeInteractionOutcome = activeInteractionPresentation && activeSource?.focus?.outcomeId
    ? activeInteractionPresentation.outcomes.find((outcome) => outcome.id === activeSource.focus?.outcomeId) ?? null
    : null;
  const activeInteractionProse = activeInteractionOutcome ? interactionOutcomeProse(activeInteractionOutcome) : null;
  const interactionDialoguePending = Boolean(
    activeInteractionOutcome
    && activeSource?.focus?.section === "narration"
    && activeInteractionProse?.dialogueText.trim(),
  );
  const secondaryProsePending = nodeDialoguePending || interactionDialoguePending;'''
new_context = '''  const narrativeContinuation = useNarrativeContinuation(snapshot, playState, activeNodeId, activeSource);
  const nodeDialoguePending = narrativeContinuation.nodeDialoguePending;
  const interactionDialoguePending = narrativeContinuation.interactionDialoguePending;
  const secondaryProsePending = narrativeContinuation.secondaryProsePending;'''
if text.count(old_context) != 1:
    raise SystemExit("Expected one App Narrative continuation derivation block")
text = text.replace(old_context, new_context)

old_show_node = '''  function showNode(project: ProjectSnapshot, node: GameNode, state: PlayState) {
    if (launchPresentationBlockingRef.current) return;
    firedCueIds.current = new Set();
    const narration = interpolateText(node.text, { snapshot: project, state });
    const dialogue = interpolateText(node.dialogueText ?? "", { snapshot: project, state });
    const beginsWithDialogue = !narration && Boolean(dialogue);
    const rawText = beginsWithDialogue ? dialogue : narration;
    const performance = beginsWithDialogue ? node.dialoguePerformance ?? DEFAULT_TEXT_PERFORMANCE : node.performance;
    const compiled = compileTextNotation(rawText, performance);
    const conversation = beginsWithDialogue ? resolveActiveNodeConversationContext(project, state) : null;
    setActiveText(compiled.text);
    setActiveNodeId(node.id);
    setActiveSpeakerId(conversation?.characterId ?? null);
    setActiveSource(authoredSource("node", node.id, { section: beginsWithDialogue ? "dialogue" : "narration" }));
    setActivePerformance(compiled.performance);
  }'''
new_show_node = '''  function showNode(project: ProjectSnapshot, node: GameNode, state: PlayState) {
    if (launchPresentationBlockingRef.current) return;
    firedCueIds.current = new Set();
    const presentation = resolveNodeOpeningPresentation(project, state, node);
    setActiveText(presentation.text);
    setActiveNodeId(node.id);
    setActiveSpeakerId(presentation.speakerId);
    setActiveSource(presentation.source);
    setActivePerformance(presentation.performance);
  }'''
if text.count(old_show_node) != 1:
    raise SystemExit("Expected one App showNode Narrative presentation block")
text = text.replace(old_show_node, new_show_node)

old_node_effect = '''  useEffect(() => {
    if (!typewriter.complete || !nodeDialoguePending || !snapshot || !playState || !activeNodePresentation) return;
    const dialogue = interpolateText(activeNodePresentation.dialogueText ?? "", { snapshot, state: playState });
    if (!dialogue) return;
    if (activeText) {
      setTranscript((lines) => [...lines, {
        id: crypto.randomUUID(),
        text: activeText,
        nodeId: activeNodePresentation.id,
        speakerId: activeSpeakerId,
        source: activeSource,
      }]);
    }
    firedCueIds.current = new Set();
    const compiled = compileTextNotation(dialogue, activeNodePresentation.dialoguePerformance ?? DEFAULT_TEXT_PERFORMANCE);
    const conversation = resolveActiveNodeConversationContext(snapshot, playState);
    setActiveText(compiled.text);
    setActiveSpeakerId(conversation?.characterId ?? null);
    setActiveSource(authoredSource("node", activeNodePresentation.id, { section: "dialogue" }));
    setActivePerformance(compiled.performance);
  }, [typewriter.complete, nodeDialoguePending, snapshot, playState, activeNodePresentation, activeText, activeSpeakerId, activeSource]);'''
new_node_effect = '''  useEffect(() => {
    const node = narrativeContinuation.node;
    const presentation = narrativeContinuation.nodeDialogue;
    if (!typewriter.complete || !nodeDialoguePending || !node || !presentation) return;
    if (activeText) {
      setTranscript((lines) => [...lines, {
        id: crypto.randomUUID(),
        text: activeText,
        nodeId: node.id,
        speakerId: activeSpeakerId,
        source: activeSource,
      }]);
    }
    firedCueIds.current = new Set();
    setActiveText(presentation.text);
    setActiveSpeakerId(presentation.speakerId);
    setActiveSource(presentation.source);
    setActivePerformance(presentation.performance);
  }, [typewriter.complete, nodeDialoguePending, narrativeContinuation.node, narrativeContinuation.nodeDialogue, activeText, activeSpeakerId, activeSource]);'''
if text.count(old_node_effect) != 1:
    raise SystemExit("Expected one App node dialogue continuation effect")
text = text.replace(old_node_effect, new_node_effect)

old_interaction_effect = '''  useEffect(() => {
    if (!typewriter.complete || !interactionDialoguePending || !snapshot || !playState || !activeInteractionPresentation || !activeInteractionOutcome || !activeInteractionProse) return;
    const dialogue = interpolateText(activeInteractionProse.dialogueText, { snapshot, state: playState });
    if (!dialogue) return;
    if (activeText) {
      setTranscript((lines) => [...lines, {
        id: crypto.randomUUID(),
        text: activeText,
        speakerId: activeSpeakerId,
        source: activeSource,
      }]);
    }
    firedCueIds.current = new Set();
    const compiled = compileTextNotation(dialogue, activeInteractionProse.dialoguePerformance);
    const conversation = resolveNodeConversationContext(snapshot, playState, activeInteractionPresentation.sourceNodeId);
    setActiveText(compiled.text);
    setActiveNodeId(undefined);
    setActiveSpeakerId(conversation?.characterId ?? activeInteractionOutcome.speakerId ?? null);
    setActiveSource(authoredSource("interaction", activeInteractionPresentation.id, {
      outcomeId: activeInteractionOutcome.id,
      section: "dialogue",
    }));
    setActivePerformance(compiled.performance);
  }, [
    typewriter.complete, interactionDialoguePending, snapshot, playState, activeInteractionPresentation,
    activeInteractionOutcome, activeInteractionProse, activeText, activeSpeakerId, activeSource,
  ]);'''
new_interaction_effect = '''  useEffect(() => {
    const presentation = narrativeContinuation.interactionDialogue;
    if (!typewriter.complete || !interactionDialoguePending || !presentation) return;
    if (activeText) {
      setTranscript((lines) => [...lines, {
        id: crypto.randomUUID(),
        text: activeText,
        speakerId: activeSpeakerId,
        source: activeSource,
      }]);
    }
    firedCueIds.current = new Set();
    setActiveText(presentation.text);
    setActiveNodeId(undefined);
    setActiveSpeakerId(presentation.speakerId);
    setActiveSource(presentation.source);
    setActivePerformance(presentation.performance);
  }, [
    typewriter.complete, interactionDialoguePending, narrativeContinuation.interactionDialogue,
    activeText, activeSpeakerId, activeSource,
  ]);'''
if text.count(old_interaction_effect) != 1:
    raise SystemExit("Expected one App interaction dialogue continuation effect")
text = text.replace(old_interaction_effect, new_interaction_effect)

for token in [
    "resolveActiveNodeConversationContext",
    "resolveNodeConversationContext",
    "interpolateText",
    "activeNodePresentation",
    "activeInteractionPresentation",
    "activeInteractionOutcome",
    "activeInteractionProse",
]:
    if token in text:
        raise SystemExit(f"Old Narrative prose presentation knowledge remains in App: {token}")
if text.count("useNarrativeContinuation(snapshot, playState, activeNodeId, activeSource)") != 1:
    raise SystemExit("Narrative continuation hook not installed exactly once")
if text.count("resolveNodeOpeningPresentation(project, state, node)") != 1:
    raise SystemExit("Narrative node opening resolver not installed exactly once")

path.write_text(text)
