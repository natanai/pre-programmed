from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} occurrence(s), found {found}: {old[:100]!r}")
    write(path, text.replace(old, new, count))


def replace_section(path: str, start: str, end: str, new_section: str) -> None:
    text = read(path)
    start_at = text.find(start)
    if start_at < 0:
        raise SystemExit(f"{path}: start marker not found: {start!r}")
    end_at = text.find(end, start_at)
    if end_at < 0:
        raise SystemExit(f"{path}: end marker not found after start: {end!r}")
    write(path, text[:start_at] + new_section + text[end_at:])


# Shared interaction prose normalization. Existing speaker-authored response text is
# interpreted as dialogue until migration 40 rewrites it into the canonical fields.
write("src/features/narrative/interactionProse.ts", '''import type { InteractionOutcome, TextPerformance } from "./model";

export const DEFAULT_INTERACTION_TEXT_PERFORMANCE: TextPerformance = {
  charactersPerSecond: 18,
  cues: [],
};

export type InteractionOutcomeProse = {
  narrationText: string;
  narrationPerformance: TextPerformance;
  dialogueText: string;
  dialoguePerformance: TextPerformance;
};

export function interactionOutcomeProse(outcome: InteractionOutcome): InteractionOutcomeProse {
  const legacy = outcome as InteractionOutcome & {
    responseCharactersPerSecond?: number;
    responsePerformance?: TextPerformance;
  };
  const responsePerformance = legacy.responsePerformance ?? {
    charactersPerSecond: legacy.responseCharactersPerSecond ?? 18,
    cues: [],
  };
  const legacySpokenResponse = outcome.dialogueText === undefined && Boolean(outcome.speakerId);
  if (legacySpokenResponse) {
    return {
      narrationText: "",
      narrationPerformance: { ...DEFAULT_INTERACTION_TEXT_PERFORMANCE, cues: [] },
      dialogueText: outcome.responseText,
      dialoguePerformance: responsePerformance,
    };
  }
  return {
    narrationText: outcome.responseText,
    narrationPerformance: responsePerformance,
    dialogueText: outcome.dialogueText ?? "",
    dialoguePerformance: outcome.dialoguePerformance ?? { ...DEFAULT_INTERACTION_TEXT_PERFORMANCE, cues: [] },
  };
}

export function normalizeInteractionOutcomeProse(outcome: InteractionOutcome): InteractionOutcome {
  const prose = interactionOutcomeProse(outcome);
  return {
    ...outcome,
    responseText: prose.narrationText,
    responsePerformance: prose.narrationPerformance,
    dialogueText: prose.dialogueText,
    dialoguePerformance: prose.dialoguePerformance,
  };
}
''')

replace(
    "src/features/narrative/model.ts",
    '''  responseText: string;\n  /** Optional voice for this immediate response; destination Node dialogue is owned by the Node. */\n  speakerId?: string | null;\n  /** The same authored-text performance contract used by Node prose. */\n  responsePerformance: TextPerformance;''',
    '''  /** Optional narration shown before this response's spoken line. */\n  responseText: string;\n  /** Optional spoken line. In a conversation, the source Node's conversation character owns the voice. */\n  dialogueText?: string;\n  /** Explicit fallback voice only when the source Node is not in an active conversation. */\n  speakerId?: string | null;\n  /** Narration delivery. */\n  responsePerformance: TextPerformance;\n  /** Spoken-line delivery. */\n  dialoguePerformance?: TextPerformance;''',
)

replace(
    "src/features/narrative/drafts.ts",
    '''    responseText,\n    speakerId: null,\n    responsePerformance: { charactersPerSecond: 18, cues: [] },''',
    '''    responseText,\n    dialogueText: "",\n    speakerId: null,\n    responsePerformance: { charactersPerSecond: 18, cues: [] },\n    dialoguePerformance: { charactersPerSecond: 18, cues: [] },''',
)

replace(
    "src/features/narrative/sceneContext.ts",
    '''export function resolveActiveNodeConversationContext(\n  snapshot: ProjectSnapshot,\n  state: Pick<PlayState, "traversal">,\n): ActiveNodeConversationContext | null {\n  return resolveActiveNodeContext(snapshot, state).conversation;\n}\n''',
    '''export function resolveActiveNodeConversationContext(\n  snapshot: ProjectSnapshot,\n  state: Pick<PlayState, "traversal">,\n): ActiveNodeConversationContext | null {\n  return resolveActiveNodeContext(snapshot, state).conversation;\n}\n\n/** Resolve the conversation specifically at one Node on the current real traversal. */\nexport function resolveNodeConversationContext(\n  snapshot: ProjectSnapshot,\n  state: Pick<PlayState, "traversal">,\n  nodeId: string,\n): ActiveNodeConversationContext | null {\n  const traversalIndex = state.traversal.lastIndexOf(nodeId);\n  if (traversalIndex >= 0) {\n    return resolveActiveNodeConversationContext(snapshot, {\n      traversal: state.traversal.slice(0, traversalIndex + 1),\n    });\n  }\n  const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);\n  if (!node || nodeConversationMode(node) !== "set") return null;\n  const characterId = nodeConversationCharacterId(node);\n  return characterId ? { characterId, sourceNodeId: node.id } : null;\n}\n''',
)

replace(
    "src/features/narrative/runtime.ts",
    '''import { transitionState } from "./effectRuntime";\nimport { interpolateText } from "./interpolation";\nimport type { Interaction, InteractionOutcome } from "./model";''',
    '''import { transitionState } from "./effectRuntime";\nimport { interactionOutcomeProse } from "./interactionProse";\nimport { interpolateText } from "./interpolation";\nimport type { Interaction, InteractionOutcome } from "./model";\nimport { resolveNodeConversationContext } from "./sceneContext";''',
)
replace(
    "src/features/narrative/runtime.ts",
    '''  responseText: string;\n  events: EffectEvent[];''',
    '''  responseText: string;\n  dialogueText: string;\n  dialogueSpeakerId: string | null;\n  events: EffectEvent[];''',
)
replace(
    "src/features/narrative/runtime.ts",
    '''  if (!outcome) return { state, outcome, responseText: "", events: [], attempt, eventKey };\n  const source = authoredSource("interaction", interaction.id, { outcomeId: outcome.id });''',
    '''  if (!outcome) return {\n    state, outcome, responseText: "", dialogueText: "", dialogueSpeakerId: null, events: [], attempt, eventKey,\n  };\n  const prose = interactionOutcomeProse(outcome);\n  const sourceConversation = resolveNodeConversationContext(snapshot, initialState, interaction.sourceNodeId);\n  const source = authoredSource("interaction", interaction.id, { outcomeId: outcome.id });''',
)
replace(
    "src/features/narrative/runtime.ts",
    '''    responseText: interpolateText(outcome.responseText, { snapshot, state }),\n    events: [...interactionEvents, ...entry.events],''',
    '''    responseText: interpolateText(prose.narrationText, { snapshot, state }),\n    dialogueText: interpolateText(prose.dialogueText, { snapshot, state }),\n    dialogueSpeakerId: sourceConversation?.characterId ?? outcome.speakerId ?? null,\n    events: [...interactionEvents, ...entry.events],''',
)

replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''import { createDraftInteraction, createDraftOutcome } from "../drafts";\nimport { buildGraphIndex, notationForNode } from "../graph";''',
    '''import { createDraftInteraction, createDraftOutcome } from "../drafts";\nimport { buildGraphIndex, notationForNode } from "../graph";\nimport { interactionOutcomeProse, normalizeInteractionOutcomeProse } from "../interactionProse";\nimport { resolveNodeConversationContext } from "../sceneContext";''',
)
replace_section(
    "src/features/narrative/author/InteractionEditor.tsx",
    "function normalizedInteraction(\n",
    "\nfunction conditionSummary",
    '''function normalizedInteraction(\n  initial: Interaction | undefined,\n  sourceNodeId: string,\n  command: string,\n  fallback: boolean,\n) {\n  const value = structuredClone(initial ?? createDraftInteraction(sourceNodeId, command, fallback));\n  value.matchMode ??= fallback ? "fallback" : "command";\n  value.choiceVisibility ??= fallback ? "typed" : "prompt";\n  value.choiceVisibleWhen ??= ALWAYS;\n  value.outcomes = value.outcomes.length ? value.outcomes.map((outcome) => normalizeInteractionOutcomeProse({\n    ...outcome,\n    authorStatus: outcome.authorStatus ?? "configured",\n  })) : [createDraftOutcome()];\n  return value;\n}\n''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''function responseSnippet(outcome: InteractionOutcome) {\n  const text = outcome.responseText.trim().replace(/\\s+/g, " ");\n  if (text) return text.length > 72 ? `${text.slice(0, 69)}...` : text;\n  if (outcome.effects.length) return `${outcome.effects.length} effect${outcome.effects.length === 1 ? "" : "s"}, no response text`;\n  return "No response yet";\n}\n\nfunction responseSpeakerLabel(snapshot: ProjectSnapshot, outcome: InteractionOutcome) {\n  if (!outcome.speakerId) return "Narration";\n  return snapshot.entities.find((entity) => entity.type === "character" && entity.id === outcome.speakerId)?.name ?? "Unknown speaker";\n}''',
    '''function responseSnippet(outcome: InteractionOutcome) {\n  const prose = interactionOutcomeProse(outcome);\n  const text = [prose.narrationText, prose.dialogueText].filter((value) => value.trim()).join(" / ").trim().replace(/\\s+/g, " ");\n  if (text) return text.length > 72 ? `${text.slice(0, 69)}...` : text;\n  if (outcome.effects.length) return `${outcome.effects.length} effect${outcome.effects.length === 1 ? "" : "s"}, no response text`;\n  return "No response yet";\n}\n\nfunction responseSpeakerLabel(snapshot: ProjectSnapshot, outcome: InteractionOutcome, conversationCharacterId: string | null) {\n  const prose = interactionOutcomeProse(outcome);\n  if (!prose.dialogueText.trim()) return "Narration";\n  const speakerId = conversationCharacterId ?? outcome.speakerId;\n  if (!speakerId) return "Conversation at runtime";\n  return snapshot.entities.find((entity) => entity.type === "character" && entity.id === speakerId)?.name ?? "Unknown speaker";\n}''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''  onPreview?: (outcome: InteractionOutcome) => void;''',
    '''  onPreview?: (value: AuthoredTextValue, speakerId: string | null, outcome: InteractionOutcome) => void;''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''  const resolvedSourceNodeId = initial?.sourceNodeId ?? sourceNodeId ?? playState.currentNodeId;\n  const sourceSpeakerId = snapshot.nodes.find((node) => node.id === resolvedSourceNodeId)?.characterId ?? null;\n  const [draft, setDraft] = useState(() => normalizedInteraction(initial, resolvedSourceNodeId, initialCommand, fallbackMode, sourceSpeakerId));''',
    '''  const resolvedSourceNodeId = initial?.sourceNodeId ?? sourceNodeId ?? playState.currentNodeId;\n  const [draft, setDraft] = useState(() => normalizedInteraction(initial, resolvedSourceNodeId, initialCommand, fallbackMode));''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''  const sourcePlayState = draft.sourceNodeId === playState.currentNodeId\n    ? playState\n    : { ...playState, currentNodeId: draft.sourceNodeId };''',
    '''  const sourceTraversalIndex = playState.traversal.lastIndexOf(draft.sourceNodeId);\n  const sourcePlayState = sourceTraversalIndex >= 0\n    ? { ...playState, currentNodeId: draft.sourceNodeId, traversal: playState.traversal.slice(0, sourceTraversalIndex + 1) }\n    : { ...playState, currentNodeId: draft.sourceNodeId };\n  const conversationCharacterId = resolveNodeConversationContext(snapshot, sourcePlayState, draft.sourceNodeId)?.characterId ?? null;''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''  const addResponseDraft = () => {\n    const outcome = { ...createDraftOutcome(draft.outcomes.length), speakerId: sourceSpeakerId };''',
    '''  const addResponseDraft = () => {\n    const outcome = createDraftOutcome(draft.outcomes.length);''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''    const invalidText = draft.outcomes.find((outcome) => validateTextNotation(outcome.responseText).length);''',
    '''    const invalidText = draft.outcomes.find((outcome) =>\n      validateTextNotation(outcome.responseText).length\n      || validateTextNotation(outcome.dialogueText ?? "").length);''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''        snapshot={snapshot}\n        notationForOutcome={notationForOutcome}''',
    '''        snapshot={snapshot}\n        conversationCharacterId={conversationCharacterId}\n        notationForOutcome={notationForOutcome}''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''        notation={notationForOutcome(selectedOutcome)}\n        autoFocusText={!initial || newOutcomeIds.has(selectedOutcome.id)}\n        onText={(responseText) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, responseText }))}\n        onPerformance={(responsePerformance) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, responsePerformance }))}\n        onSpeaker={(speakerId) => configureOutcome(selectedOutcome.id, (outcome) => ({ ...outcome, speakerId }))}\n        onPreview={onPreview ? () => onPreview(selectedOutcome) : undefined}\n        playState={sourcePlayState}''',
    '''        notation={notationForOutcome(selectedOutcome)}\n        autoFocusText={!initial || newOutcomeIds.has(selectedOutcome.id)}\n        conversationCharacterId={conversationCharacterId}\n        onPreview={onPreview ? (value, speakerId) => onPreview(value, speakerId, selectedOutcome) : undefined}\n        playState={sourcePlayState}''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''  snapshot,\n  notationForOutcome,''',
    '''  snapshot,\n  conversationCharacterId,\n  notationForOutcome,''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''  snapshot: ProjectSnapshot;\n  notationForOutcome: (outcome: InteractionOutcome) => string;''',
    '''  snapshot: ProjectSnapshot;\n  conversationCharacterId: string | null;\n  notationForOutcome: (outcome: InteractionOutcome) => string;''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''            <small>SPEAKER: {responseSpeakerLabel(snapshot, outcome)} · WHEN: {conditionSummary(outcome.condition)} · AFTER: {destinationLabel(snapshot, outcome)} · {outcome.effects.length} effect{outcome.effects.length === 1 ? "" : "s"}</small>''',
    '''            <small>SPEAKER: {responseSpeakerLabel(snapshot, outcome, conversationCharacterId)} · WHEN: {conditionSummary(outcome.condition)} · AFTER: {destinationLabel(snapshot, outcome)} · {outcome.effects.length} effect{outcome.effects.length === 1 ? "" : "s"}</small>''',
)

replace_section(
    "src/features/narrative/author/InteractionEditor.tsx",
    "function ResponseWorkspace(",
    "\nfunction AfterWorkspace",
    '''function ResponseWorkspace({ outcome, snapshot, playState, index, total, notation, autoFocusText, conversationCharacterId, onPreview, onCreateDestination, onEditDestination, onChange, onMove, onRemove }: {\n  outcome: InteractionOutcome;\n  snapshot: ProjectSnapshot;\n  playState: PlayState;\n  index: number;\n  total: number;\n  notation: string;\n  autoFocusText: boolean;\n  conversationCharacterId: string | null;\n  onPreview?: (value: AuthoredTextValue, speakerId: string | null) => void;\n  onCreateDestination?: () => void;\n  onEditDestination?: (nodeId: string) => void;\n  onChange: (change: (outcome: InteractionOutcome) => InteractionOutcome) => void;\n  onMove: (direction: -1 | 1) => void;\n  onRemove?: () => void;\n}) {\n  const prose = interactionOutcomeProse(outcome);\n  const dialogueSpeakerId = conversationCharacterId ?? outcome.speakerId ?? null;\n  const dialogueSpeakerName = dialogueSpeakerId\n    ? snapshot.entities.find((entity) => entity.type === "character" && entity.id === dialogueSpeakerId)?.name ?? "Unknown character"\n    : "";\n  const showDialogueEditor = Boolean(conversationCharacterId || outcome.speakerId || prose.dialogueText.trim());\n  const dialogueLabel = dialogueSpeakerName\n    ? `${dialogueSpeakerName.toUpperCase()} SAYS`\n    : "DIALOGUE — CHOOSE SPEAKER";\n\n  return <div className="guided-subworkspace response-workspace">\n    <div className="guided-response-status"><span className={outcome.authorStatus === "draft" ? "draft-input" : ""}>{notation}</span><span>Response {index + 1} of {total}</span></div>\n    <section className="guided-section response-writing-section">\n      <h3>RESPONSE</h3>\n      {!conversationCharacterId ? <label>SPEAKER\n        <ReferenceField\n          kind="character"\n          value={outcome.speakerId ?? ""}\n          onChange={(speakerId) => onChange((current) => ({ ...current, speakerId: speakerId || null }))}\n          placeholder="none / narration"\n        />\n        <small>Optional outside a conversation. In an active conversation, the Node's conversation character is used automatically.</small>\n      </label> : null}\n      <div className={`narrative-prose-grid${showDialogueEditor ? " has-dialogue" : ""}`}>\n        <AuthoredTextEditor\n          value={{ text: prose.narrationText, performance: prose.narrationPerformance }}\n          snapshot={snapshot}\n          playState={playState}\n          label="NARRATION"\n          rows={5}\n          autoFocus={autoFocusText && !dialogueSpeakerId}\n          onChange={(value) => onChange((current) => ({\n            ...current,\n            responseText: value.text,\n            responsePerformance: value.performance,\n          }))}\n          onPreview={onPreview ? (value) => onPreview(value, null) : undefined}\n        />\n        {showDialogueEditor ? <AuthoredTextEditor\n          value={{ text: prose.dialogueText, performance: prose.dialoguePerformance }}\n          snapshot={snapshot}\n          playState={playState}\n          label={dialogueLabel}\n          rows={5}\n          autoFocus={autoFocusText && Boolean(dialogueSpeakerId)}\n          onChange={(value) => onChange((current) => ({\n            ...current,\n            dialogueText: value.text,\n            dialoguePerformance: value.performance,\n          }))}\n          onPreview={onPreview ? (value) => onPreview(value, dialogueSpeakerId) : undefined}\n        /> : null}\n      </div>\n    </section>\n    <div className="interaction-outcome-composer" aria-label="Complete response outcome">\n      <OutcomeComposerSection title="WHEN" summary={conditionSummary(outcome.condition)}>\n        <OutcomeConditionEditor condition={outcome.condition} snapshot={snapshot} onChange={(condition) => onChange((current) => ({ ...current, condition }))} />\n      </OutcomeComposerSection>\n      <OutcomeComposerSection title="AFTER" summary={destinationLabel(snapshot, outcome)}>\n        <AfterWorkspace\n          outcome={outcome}\n          snapshot={snapshot}\n          playState={playState}\n          onCreateDestination={onCreateDestination}\n          onEditDestination={onEditDestination}\n          onChange={onChange}\n        />\n      </OutcomeComposerSection>\n      <OutcomeComposerSection title="EFFECTS" summary={outcome.effects.length ? `${outcome.effects.length} configured` : "None"}>\n        <OutcomeEffectsEditor effects={outcome.effects} snapshot={snapshot} onChange={(effects) => onChange((current) => ({ ...current, effects }))} />\n      </OutcomeComposerSection>\n      <OutcomeComposerSection title="AUTHOR DETAILS" summary={outcome.label.trim() || "Optional label"}>\n        <p className="guided-context-copy">Private organization for this response. It is never shown to the player.</p>\n        <label>RESPONSE LABEL <input value={outcome.label} placeholder="optional private label" onChange={(event) => onChange((current) => ({ ...current, label: event.target.value }))} /></label>\n      </OutcomeComposerSection>\n    </div>\n    <div className="guided-response-actions">\n      <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>[MOVE UP]</button>\n      <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>[MOVE DOWN]</button>\n      {onRemove ? <button type="button" onClick={onRemove}>[REMOVE RESPONSE]</button> : null}\n    </div>\n  </div>;\n}\n''',
)

replace(
    "src/features/narrative/author/manifest.tsx",
    '''          onPreview={(outcome) => context.runtime.preview({\n            text: outcome.responseText,\n            performance: outcome.responsePerformance,\n            speakerId: outcome.speakerId,\n            events: previewEventsForEffects(outcome.effects, context.snapshot),\n          })}''',
    '''          onPreview={(value, speakerId, outcome) => context.runtime.preview({\n            text: value.text,\n            performance: value.performance,\n            speakerId,\n            events: previewEventsForEffects(outcome.effects, context.snapshot),\n          })}''',
)

replace(
    "src/features/narrative/author/nodeWorkspace.tsx",
    'className={`node-prose-grid${showDialogueEditor ? " has-dialogue" : ""}`}',
    'className={`narrative-prose-grid${showDialogueEditor ? " has-dialogue" : ""}`}',
)
replace(
    "src/features/narrative/author/nodeWorkspace.css",
    '''.node-prose-grid {\n  display: grid;\n  gap: .9em;\n  min-width: 0;\n}\n\n.node-prose-grid.has-dialogue {\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));\n  align-items: start;\n}\n\n.node-prose-grid > * {\n  min-width: 0;\n}\n\n''',
    "",
)
replace(
    "src/features/narrative/author/authoredTextEditor.css",
    '''.authored-text-errors {\n  display: grid;''',
    '''.narrative-prose-grid {\n  display: grid;\n  gap: .9em;\n  min-width: 0;\n}\n\n.narrative-prose-grid.has-dialogue {\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));\n  align-items: start;\n}\n\n.narrative-prose-grid > * {\n  min-width: 0;\n}\n\n.authored-text-errors {\n  display: grid;''',
)

replace(
    "src/author/search/projectSearch.ts",
    '''              outcome.label,\n              outcome.responseText,\n              JSON.stringify(outcome.condition),''',
    '''              outcome.label,\n              outcome.responseText,\n              outcome.dialogueText ?? "",\n              JSON.stringify(outcome.condition),''',
)
replace(
    "src/author/search/projectSearch.ts",
    '''          outcome.label,\n          outcome.responseText,\n          JSON.stringify(outcome.condition),''',
    '''          outcome.label,\n          outcome.responseText,\n          outcome.dialogueText ?? "",\n          JSON.stringify(outcome.condition),''',
)

replace(
    "worker/features/narrativePersistence.ts",
    '''import type { GameNode, Interaction, TextPerformance } from "../../src/features/narrative/model";''',
    '''import { normalizeInteractionOutcomeProse } from "../../src/features/narrative/interactionProse";\nimport type { GameNode, Interaction, TextPerformance } from "../../src/features/narrative/model";''',
)
replace(
    "worker/features/narrativePersistence.ts",
    '''  response_text: string;\n  response_speaker_id: string | null;\n  response_characters_per_second: number;\n  response_performance_json: string;''',
    '''  response_text: string;\n  response_dialogue_text: string;\n  response_speaker_id: string | null;\n  response_characters_per_second: number;\n  response_performance_json: string;\n  response_dialogue_performance_json: string;''',
)
replace(
    "worker/features/narrativePersistence.ts",
    '''        UPDATE project_meta SET schema_version = 39 WHERE id = 1;\n      `,\n    },\n  ],''',
    '''        UPDATE project_meta SET schema_version = 39 WHERE id = 1;\n      `,\n    },\n    {\n      id: 40,\n      name: "narrative-interaction-conversation-prose",\n      sql: `\n        ALTER TABLE interaction_outcomes\n        ADD COLUMN response_dialogue_text TEXT NOT NULL DEFAULT '';\n\n        ALTER TABLE interaction_outcomes\n        ADD COLUMN response_dialogue_performance_json TEXT NOT NULL DEFAULT '{"charactersPerSecond":18,"cues":[]}';\n\n        UPDATE interaction_outcomes\n        SET response_dialogue_text = response_text,\n            response_dialogue_performance_json = response_performance_json,\n            response_text = '',\n            response_characters_per_second = 18,\n            response_performance_json = '{"charactersPerSecond":18,"cues":[]}'\n        WHERE response_speaker_id IS NOT NULL;\n\n        UPDATE project_meta SET schema_version = 40 WHERE id = 1;\n      `,\n    },\n  ],''',
)
replace(
    "worker/features/narrativePersistence.ts",
    '''        `SELECT id, interaction_id, order_index, label, author_status, condition_json, response_text, response_speaker_id,\n                response_characters_per_second, response_performance_json, effects_json, disposition, destination_node_id''',
    '''        `SELECT id, interaction_id, order_index, label, author_status, condition_json, response_text, response_dialogue_text, response_speaker_id,\n                response_characters_per_second, response_performance_json, response_dialogue_performance_json, effects_json, disposition, destination_node_id''',
)
replace(
    "worker/features/narrativePersistence.ts",
    '''          responseText: outcome.response_text,\n          speakerId: outcome.response_speaker_id,\n          responsePerformance: migrateLegacyMediaCues(parseJson(outcome.response_performance_json, {\n            charactersPerSecond: outcome.response_characters_per_second,\n            cues: [],\n          })),\n          effects:''',
    '''          responseText: outcome.response_text,\n          dialogueText: outcome.response_dialogue_text ?? "",\n          speakerId: outcome.response_speaker_id,\n          responsePerformance: migrateLegacyMediaCues(parseJson(outcome.response_performance_json, {\n            charactersPerSecond: outcome.response_characters_per_second,\n            cues: [],\n          })),\n          dialoguePerformance: migrateLegacyMediaCues(parseJson(\n            outcome.response_dialogue_performance_json,\n            DEFAULT_TEXT_PERFORMANCE,\n          )),\n          effects:''',
)
replace_section(
    "worker/features/narrativePersistence.ts",
    "        ...value.outcomes.map((outcome) => {",
    "      ];\n    }\n\n    if (operation.type === \"interaction.delete\")",
    '''        ...value.outcomes.map((rawOutcome) => {\n          const outcome = normalizeInteractionOutcomeProse(rawOutcome);\n          const performance = outcome.responsePerformance ?? DEFAULT_TEXT_PERFORMANCE;\n          const dialoguePerformance = outcome.dialoguePerformance ?? DEFAULT_TEXT_PERFORMANCE;\n          return db.prepare(\n            `INSERT INTO interaction_outcomes\n             (id, interaction_id, order_index, label, condition_json, response_text, response_dialogue_text, response_speaker_id,\n              response_characters_per_second, response_performance_json, response_dialogue_performance_json, effects_json, disposition, destination_node_id, author_status)\n             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,\n          ).bind(\n            outcome.id,\n            value.id,\n            outcome.order,\n            outcome.label,\n            JSON.stringify(outcome.condition),\n            outcome.responseText,\n            outcome.dialogueText ?? "",\n            outcome.speakerId ?? null,\n            performance.charactersPerSecond,\n            JSON.stringify(performance),\n            JSON.stringify(dialoguePerformance),\n            JSON.stringify(outcome.effects),\n            outcome.disposition,\n            outcome.destinationNodeId,\n            outcome.authorStatus ?? "configured",\n          );\n        }),\n      ];\n    }\n\n    if (operation.type === "interaction.delete")''',
)

replace(
    "worker/features/narrativeValidation.ts",
    '''      if (!validLegacyQueuedOutcome && !textPerformanceValid(performance)) {\n        return "Response text performance is invalid.";\n      }\n      if (candidate.speakerId !== undefined''',
    '''      if (!validLegacyQueuedOutcome && !textPerformanceValid(performance)) {\n        return "Response text performance is invalid.";\n      }\n      if (candidate.dialogueText !== undefined\n        && (typeof candidate.dialogueText !== "string" || candidate.dialogueText.length > 20000)) {\n        return "Response dialogue text is invalid.";\n      }\n      if (candidate.dialoguePerformance !== undefined && !textPerformanceValid(candidate.dialoguePerformance)) {\n        return "Response dialogue performance is invalid.";\n      }\n      if (candidate.speakerId !== undefined''',
)

replace(
    "src/App.tsx",
    '''import { resolveActiveNodeConversationContext } from "./features/narrative/sceneContext";\nimport { interpolateText } from "./features/narrative/interpolation";''',
    '''import { resolveActiveNodeConversationContext, resolveNodeConversationContext } from "./features/narrative/sceneContext";\nimport { interactionOutcomeProse } from "./features/narrative/interactionProse";\nimport { interpolateText } from "./features/narrative/interpolation";''',
)
replace(
    "src/App.tsx",
    '''  responseText: string;\n  source?: AuthoredSourceIdentity;''',
    '''  responseText: string;\n  dialogueText?: string;\n  dialogueSpeakerId?: string | null;\n  source?: AuthoredSourceIdentity;''',
)
replace(
    "src/App.tsx",
    '''  const nodeDialoguePending = Boolean(\n    activeNodePresentation\n    && activeSource?.resourceKind === "node"\n    && activeSource.resourceId === activeNodePresentation.id\n    && activeSource.focus?.section === "narration"\n    && activeNodePresentation.dialogueText?.trim(),\n  );''',
    '''  const nodeDialoguePending = Boolean(\n    activeNodePresentation\n    && activeSource?.resourceKind === "node"\n    && activeSource.resourceId === activeNodePresentation.id\n    && activeSource.focus?.section === "narration"\n    && activeNodePresentation.dialogueText?.trim(),\n  );\n  const activeInteractionPresentation = snapshot && activeSource?.resourceKind === "interaction"\n    ? snapshot.interactions.find((interaction) => interaction.id === activeSource.resourceId) ?? null\n    : null;\n  const activeInteractionOutcome = activeInteractionPresentation && activeSource?.focus?.outcomeId\n    ? activeInteractionPresentation.outcomes.find((outcome) => outcome.id === activeSource.focus?.outcomeId) ?? null\n    : null;\n  const activeInteractionProse = activeInteractionOutcome ? interactionOutcomeProse(activeInteractionOutcome) : null;\n  const interactionDialoguePending = Boolean(\n    activeInteractionOutcome\n    && activeSource?.focus?.section === "narration"\n    && activeInteractionProse?.dialogueText.trim(),\n  );\n  const secondaryProsePending = nodeDialoguePending || interactionDialoguePending;''',
)
replace(
    "src/App.tsx",
    '''    if (!typewriter.complete || nodeDialoguePending || pendingDestinationNodeId || panel || playerWorkspace || pendingPlaySession || activeRadix) return;''',
    '''    if (!typewriter.complete || secondaryProsePending || pendingDestinationNodeId || panel || playerWorkspace || pendingPlaySession || activeRadix) return;''',
)
replace(
    "src/App.tsx",
    '''  }, [typewriter.complete, nodeDialoguePending, pendingDestinationNodeId, panel, playerWorkspace, pendingPlaySession, requestingKey, activeRadix]);''',
    '''  }, [typewriter.complete, secondaryProsePending, pendingDestinationNodeId, panel, playerWorkspace, pendingPlaySession, requestingKey, activeRadix]);''',
)
replace(
    "src/App.tsx",
    '''  useEffect(() => {\n    if (!snapshot || !playState || !playSessionReady || pendingPlaySession || !installationText.ready || startupRunRef.current) return;''',
    '''  useEffect(() => {\n    if (!typewriter.complete || !interactionDialoguePending || !snapshot || !playState || !activeInteractionPresentation || !activeInteractionOutcome || !activeInteractionProse) return;\n    const dialogue = interpolateText(activeInteractionProse.dialogueText, { snapshot, state: playState });\n    if (!dialogue) return;\n    if (activeText) {\n      setTranscript((lines) => [...lines, {\n        id: crypto.randomUUID(),\n        text: activeText,\n        speakerId: activeSpeakerId,\n        source: activeSource,\n      }]);\n    }\n    firedCueIds.current = new Set();\n    const compiled = compileTextNotation(dialogue, activeInteractionProse.dialoguePerformance);\n    const conversation = resolveNodeConversationContext(snapshot, playState, activeInteractionPresentation.sourceNodeId);\n    setActiveText(compiled.text);\n    setActiveNodeId(undefined);\n    setActiveSpeakerId(conversation?.characterId ?? activeInteractionOutcome.speakerId ?? null);\n    setActiveSource(authoredSource("interaction", activeInteractionPresentation.id, {\n      outcomeId: activeInteractionOutcome.id,\n      section: "dialogue",\n    }));\n    setActivePerformance(compiled.performance);\n  }, [\n    typewriter.complete, interactionDialoguePending, snapshot, playState, activeInteractionPresentation,\n    activeInteractionOutcome, activeInteractionProse, activeText, activeSpeakerId, activeSource,\n  ]);\n\n  useEffect(() => {\n    if (!snapshot || !playState || !playSessionReady || pendingPlaySession || !installationText.ready || startupRunRef.current) return;''',
)
replace(
    "src/App.tsx",
    '''    if (!typewriter.complete || !pendingDestinationNodeId || !snapshot || !playState || !activeText) return;''',
    '''    if (!typewriter.complete || secondaryProsePending || !pendingDestinationNodeId || !snapshot || !playState || !activeText) return;''',
)
replace(
    "src/App.tsx",
    '''  }, [typewriter.complete, pendingDestinationNodeId, snapshot, playState, activeText, activeSpeakerId, activeSource]);''',
    '''  }, [typewriter.complete, secondaryProsePending, pendingDestinationNodeId, snapshot, playState, activeText, activeSpeakerId, activeSource]);''',
)
replace_section(
    "src/App.tsx",
    "  const presentRuntimeExecution = (\n",
    "\n  useEffect(() => {\n    for (const cue of activePerformance.cues)",
    '''  const presentRuntimeExecution = (\n    project: ProjectSnapshot,\n    execution: RuntimePresentationExecution,\n    previousState: PlayState,\n    commandLineId: string,\n    performance: TextPerformance = DEFAULT_TEXT_PERFORMANCE,\n    speakerId: string | null = null,\n    dialoguePerformance: TextPerformance = DEFAULT_TEXT_PERFORMANCE,\n  ) => {\n    setPlayState(execution.state);\n    handleEffectEvents(execution.events, commandLineId);\n    const transitioned = execution.state.traversal.length > previousState.traversal.length;\n    const destination = transitioned\n      ? project.nodes.find((node) => node.id === execution.state.currentNodeId)\n      : undefined;\n    const dialogueText = execution.dialogueText ?? "";\n    const beginsWithDialogue = !execution.responseText && Boolean(dialogueText);\n    const rawText = beginsWithDialogue ? dialogueText : execution.responseText;\n    const rawPerformance = beginsWithDialogue ? dialoguePerformance : performance;\n    const rawSpeakerId = beginsWithDialogue ? execution.dialogueSpeakerId ?? null : speakerId;\n    let source = execution.source;\n    if (source?.resourceKind === "interaction") {\n      source = authoredSource("interaction", source.resourceId, {\n        ...(source.focus ?? {}),\n        section: beginsWithDialogue ? "dialogue" : "narration",\n      });\n    }\n    if (rawText) {\n      firedCueIds.current = new Set();\n      completedPendingDestination.current = "";\n      const compiled = compileTextNotation(rawText, rawPerformance);\n      setActiveText(compiled.text);\n      setActiveNodeId(undefined);\n      setActiveSpeakerId(rawSpeakerId);\n      setActiveSource(source);\n      setActivePerformance(compiled.performance);\n      setPendingDestinationNodeId(destination?.id ?? null);\n    } else if (destination) {\n      setPendingDestinationNodeId(null);\n      showNode(project, destination, execution.state);\n    } else {\n      setPendingDestinationNodeId(null);\n      setActiveText("");\n      setActiveNodeId(undefined);\n      setActiveSpeakerId(null);\n      setActiveSource(undefined);\n    }\n  };\n''',
)
replace(
    "src/App.tsx",
    '''    const execution = executeInteraction(snapshot, commandState, parsed.interaction);\n    presentRuntimeExecution(\n      snapshot,\n      execution,\n      commandState,\n      commandLineId,\n      execution.outcome?.responsePerformance ?? DEFAULT_TEXT_PERFORMANCE,\n      execution.outcome?.speakerId ?? null,\n    );''',
    '''    const execution = executeInteraction(snapshot, commandState, parsed.interaction);\n    const responseProse = execution.outcome ? interactionOutcomeProse(execution.outcome) : null;\n    presentRuntimeExecution(\n      snapshot,\n      execution,\n      commandState,\n      commandLineId,\n      responseProse?.narrationPerformance ?? DEFAULT_TEXT_PERFORMANCE,\n      null,\n      responseProse?.dialoguePerformance ?? DEFAULT_TEXT_PERFORMANCE,\n    );''',
)
replace(
    "src/App.tsx",
    '''  const activePresentationEditable = authorExperience && typewriter.complete && !nodeDialoguePending && canEditAuthorSource(activePresentationSource);''',
    '''  const activePresentationEditable = authorExperience && typewriter.complete && !secondaryProsePending && canEditAuthorSource(activePresentationSource);''',
)
replace(
    "src/App.tsx",
    '''          if (!typewriter.complete || nodeDialoguePending || pendingDestinationNodeId) {''',
    '''          if (!typewriter.complete || secondaryProsePending || pendingDestinationNodeId) {''',
)
replace(
    "src/App.tsx",
    '''        immediateChoices={requestingKey || !typewriter.complete || nodeDialoguePending || Boolean(pendingDestinationNodeId) ? [] : immediateTerminalChoices}\n        menuChoices={requestingKey || !typewriter.complete || nodeDialoguePending || Boolean(pendingDestinationNodeId) ? [] : promptTerminalChoices}\n        anchor={!requestingKey && !nodeDialoguePending && !pendingDestinationNodeId && activeNodeAnchor ? {''',
    '''        immediateChoices={requestingKey || !typewriter.complete || secondaryProsePending || Boolean(pendingDestinationNodeId) ? [] : immediateTerminalChoices}\n        menuChoices={requestingKey || !typewriter.complete || secondaryProsePending || Boolean(pendingDestinationNodeId) ? [] : promptTerminalChoices}\n        anchor={!requestingKey && !secondaryProsePending && !pendingDestinationNodeId && activeNodeAnchor ? {''',
)
replace(
    "src/App.tsx",
    '''        {authorExperience && typewriter.complete && !nodeDialoguePending && !pendingDestinationNodeId && !requestingKey''',
    '''        {authorExperience && typewriter.complete && !secondaryProsePending && !pendingDestinationNodeId && !requestingKey''',
)
replace(
    "src/App.tsx",
    '''        {authorExperience && typewriter.complete && !nodeDialoguePending && !pendingDestinationNodeId && !panel''',
    '''        {authorExperience && typewriter.complete && !secondaryProsePending && !pendingDestinationNodeId && !panel''',
)

replace(
    "tests/fixtures.ts",
    '''      id: `${id}-outcome`, order: 0, label: "default", authorStatus: "configured", condition: { type: "always" }, responseText: "",\n      speakerId: null, responsePerformance: { charactersPerSecond: 18, cues: [] }, effects: [], disposition: destinationNodeId ? "transition" : "stay", destinationNodeId,''',
    '''      id: `${id}-outcome`, order: 0, label: "default", authorStatus: "configured", condition: { type: "always" }, responseText: "", dialogueText: "",\n      speakerId: null, responsePerformance: { charactersPerSecond: 18, cues: [] }, dialoguePerformance: { charactersPerSecond: 18, cues: [] }, effects: [], disposition: destinationNodeId ? "transition" : "stay", destinationNodeId,''',
)
replace(
    "tests/sceneContext.test.ts",
    '''import { parseCommand } from "../src/features/commands/parser";\nimport { resolveActiveNodeAnchor } from "../src/features/narrative/anchor";''',
    '''import { parseCommand } from "../src/features/commands/parser";\nimport { resolveActiveNodeAnchor } from "../src/features/narrative/anchor";\nimport { executeInteraction } from "../src/features/narrative/runtime";''',
)
replace(
    "tests/sceneContext.test.ts",
    '''import { node, project } from "./fixtures";''',
    '''import { interaction, node, project } from "./fixtures";''',
)
replace(
    "tests/sceneContext.test.ts",
    '''    expect(interpolateSemanticReferences(name, { snapshot, state })).toBe("Marta");\n  });''',
    '''    expect(interpolateSemanticReferences(name, { snapshot, state })).toBe("Marta");\n\n    const ask = interaction("ask", "b", "c");\n    ask.outcomes[0] = {\n      ...ask.outcomes[0],\n      responseText: "You hesitate.",\n      dialogueText: "Come with me.",\n    };\n    const withResponse = {\n      ...snapshot,\n      nodes: [...snapshot.nodes, { ...node("c", 3), conversationMode: "continue", conversationCharacterId: null }],\n      interactions: [ask],\n    };\n    const execution = executeInteraction(withResponse, state, ask);\n    expect(execution.responseText).toBe("You hesitate.");\n    expect(execution.dialogueText).toBe("Come with me.");\n    expect(execution.dialogueSpeakerId).toBe(marta.id);\n    expect(execution.state.currentNodeId).toBe("c");\n  });''',
)
replace(
    "tests/migrations.test.ts",
    '''  it("turns legacy exposed State values into ordinary Status-group membership", () => {''',
    '''  it("moves legacy speaker-authored interaction text into dialogue without losing its voice", () => {\n    const database = new DatabaseSync(":memory:");\n    const migrations = currentMigrations();\n    const proseMigration = migrations.find((migration) => migration.id === 40);\n    expect(proseMigration).toBeDefined();\n\n    try {\n      for (const migration of migrations.filter((migration) => migration.id < 40)) {\n        applyMigration(database, migration.sql);\n      }\n      const start = database.prepare("SELECT start_node_id FROM project_meta WHERE id = 1").get() as { start_node_id: string };\n      database.exec(`\n        INSERT INTO entity_definitions (id, key, entity_type, name)\n        VALUES ('marta', 'marta', 'character', 'Marta');\n        INSERT INTO interactions (id, source_node_id, wording)\n        VALUES ('ask', '${start.start_node_id}', 'ask');\n        INSERT INTO interaction_outcomes\n          (id, interaction_id, response_text, response_speaker_id, response_characters_per_second, response_performance_json)\n        VALUES\n          ('answer', 'ask', 'Hello.', 'marta', 27, '{"charactersPerSecond":27,"cues":[]}');\n      `);\n\n      applyMigration(database, proseMigration!.sql);\n      const row = database.prepare(`\n        SELECT response_text, response_dialogue_text, response_speaker_id,\n               response_performance_json, response_dialogue_performance_json\n        FROM interaction_outcomes WHERE id = 'answer'\n      `).get() as {\n        response_text: string;\n        response_dialogue_text: string;\n        response_speaker_id: string | null;\n        response_performance_json: string;\n        response_dialogue_performance_json: string;\n      };\n      expect(row.response_text).toBe("");\n      expect(row.response_dialogue_text).toBe("Hello.");\n      expect(row.response_speaker_id).toBe("marta");\n      expect(JSON.parse(row.response_performance_json).charactersPerSecond).toBe(18);\n      expect(JSON.parse(row.response_dialogue_performance_json).charactersPerSecond).toBe(27);\n    } finally {\n      database.close();\n    }\n  });\n\n  it("turns legacy exposed State values into ordinary Status-group membership", () => {''',
)

print("Interaction conversation prose transformation applied.")
