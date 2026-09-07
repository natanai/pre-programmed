from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text()

replacements = {
    'import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";': 'import { useEffect, useLayoutEffect, useRef, useState } from "react";',
    'import { buildGraphIndex, notationForNode } from "./features/narrative/graph";\n': '',
    'import { isInteractionChoiceVisible } from "./features/narrative/choiceVisibility";\n': '',
    'import { resolveActiveNodeAnchor } from "./features/narrative/anchor";\n': '',
    'import { interpolateText } from "./features/narrative/interpolation";\n': 'import { interpolateText } from "./features/narrative/interpolation";\nimport { useNarrativePlayerSurface } from "./features/narrative/runtime/useNarrativePlayerSurface";\n',
    'import type { GameNode, Interaction, TextPerformance } from "./features/narrative/model";': 'import type { GameNode, TextPerformance } from "./features/narrative/model";',
    '  TerminalCommandComposer,\n  type TerminalCommandChoice,\n  type TerminalCommandComposerHandle,': '  TerminalCommandComposer,\n  type TerminalCommandComposerHandle,',
}
for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f"Expected one App import match: {old}")
    text = text.replace(old, new)

old_choice = '''function terminalChoiceForInteraction(interaction: Interaction): TerminalCommandChoice {
  return {
    id: interaction.id,
    text: interaction.aliases[0] || interaction.wording,
  };
}

'''
if text.count(old_choice) != 1:
    raise SystemExit("Expected one terminalChoiceForInteraction helper")
text = text.replace(old_choice, "")

old_current = '''  const currentNode = snapshot && playState
    ? snapshot.nodes.find((node) => node.id === playState.currentNodeId) ?? null
    : null;
  const activeNodeAnchor = snapshot && playState ? resolveActiveNodeAnchor(snapshot, playState) : null;'''
new_current = '''  const narrativeSurface = useNarrativePlayerSurface(snapshot, playState);
  const currentNode = narrativeSurface.currentNode;
  const activeNodeAnchor = narrativeSurface.anchor;'''
if text.count(old_current) != 1:
    raise SystemExit("Expected one current Narrative surface derivation block")
text = text.replace(old_current, new_current)

old_surface = '''  const graph = useMemo(() => snapshot ? buildGraphIndex(snapshot) : null, [snapshot]);
  const currentNotation = snapshot && playState && graph
    ? notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, playState.currentNodeId)
    : [];
  const currentInputs = snapshot && playState
    ? snapshot.interactions.filter((interaction) => interaction.sourceNodeId === playState.currentNodeId && (interaction.matchMode ?? "command") === "command")
    : [];
  const fallbackInput = snapshot && playState
    ? snapshot.interactions.find((interaction) => interaction.sourceNodeId === playState.currentNodeId && interaction.matchMode === "fallback")
    : undefined;
  const playerChoiceInputs = snapshot && playState
    ? currentInputs.filter((interaction) => isInteractionChoiceVisible(snapshot, playState, interaction))
    : [];
  const immediateChoices = playerChoiceInputs.filter((interaction) => interaction.choiceVisibility === "immediate");
  const promptChoices = playerChoiceInputs.filter((interaction) => (interaction.choiceVisibility ?? "prompt") === "prompt");
  const immediateTerminalChoices = immediateChoices.map(terminalChoiceForInteraction).filter((choice) => choice.text);
  const promptTerminalChoices = promptChoices.map(terminalChoiceForInteraction).filter((choice) => choice.text);'''
new_surface = '''  const currentNotation = narrativeSurface.currentNotation;
  const fallbackInput = narrativeSurface.fallbackInput;
  const immediateTerminalChoices = narrativeSurface.immediateChoices;
  const promptTerminalChoices = narrativeSurface.promptChoices;'''
if text.count(old_surface) != 1:
    raise SystemExit("Expected one Narrative graph/input derivation block")
text = text.replace(old_surface, new_surface)

old_notation = '''  const notationForInput = (interaction: Interaction) => {
    if (interaction.outcomes.some((outcome) => (outcome.authorStatus ?? "configured") === "draft")) return "[D]";
    const first = [...interaction.outcomes].sort((left, right) => left.order - right.order)[0];
    if (!first) return "[D]";
    if (first.disposition === "stay" || !first.destinationNodeId) return "[H]";
    if (!snapshot || !playState || !graph) return "[A1]";
    return notationForNode(snapshot, graph, playState.currentNodeId, playState.traversal, first.destinationNodeId).join("") || "[A1]";
  };

'''
if text.count(old_notation) != 1:
    raise SystemExit("Expected one notationForInput helper")
text = text.replace(old_notation, "")

old_invalid = '''  const invalidDraft = Boolean(fallbackInput && notationForInput(fallbackInput) === "[D]");
  const invalidLabel = fallbackInput ? `${notationForInput(fallbackInput)} INVALID` : "[+ INVALID]";'''
new_invalid = '''  const invalidDraft = Boolean(fallbackInput && narrativeSurface.fallbackNotation === "[D]");
  const invalidLabel = fallbackInput ? `${narrativeSurface.fallbackNotation} INVALID` : "[+ INVALID]";'''
if text.count(old_invalid) != 1:
    raise SystemExit("Expected one fallback notation UI block")
text = text.replace(old_invalid, new_invalid)

for token in [
    "buildGraphIndex",
    "notationForNode",
    "isInteractionChoiceVisible",
    "resolveActiveNodeAnchor",
    "terminalChoiceForInteraction",
    "TerminalCommandChoice",
    "notationForInput(",
]:
    if token in text:
        raise SystemExit(f"Old Narrative surface knowledge remains in App: {token}")
if text.count("useNarrativePlayerSurface(snapshot, playState)") != 1:
    raise SystemExit("Narrative player surface hook not installed exactly once")

path.write_text(text)
