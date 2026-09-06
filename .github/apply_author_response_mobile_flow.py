from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{path}: expected {count} occurrence(s), found {found}: {old[:120]!r}")
    write(path, text.replace(old, new, count))


def replace_section(path: str, start: str, end: str, new_section: str) -> None:
    text = read(path)
    start_at = text.find(start)
    if start_at < 0:
        raise SystemExit(f"{path}: start marker not found: {start!r}")
    end_at = text.find(end, start_at)
    if end_at < 0:
        raise SystemExit(f"{path}: end marker not found: {end!r}")
    write(path, text[:start_at] + new_section + text[end_at:])


# The live-play notation is the Author affordance. Preserve player wording as the
# real player action, but use the notation to enter the deepest unambiguous owner.
replace(
    "src/features/narrative/author/manifest.tsx",
    '''      onEdit={(interaction) => context.pushTask({\n        type: "feature",\n        feature: "narrative",\n        workspace: "interaction",\n        data: { interactionId: interaction.id },\n      })}''',
    '''      onEdit={(interaction) => {\n        context.pushTask({\n          type: "feature",\n          feature: "narrative",\n          workspace: "node",\n          data: { nodeId: interaction.sourceNodeId },\n        });\n        const directOutcomeId = interaction.outcomes.length === 1 ? interaction.outcomes[0]?.id : undefined;\n        context.pushTask({\n          type: "feature",\n          feature: "narrative",\n          workspace: "interaction",\n          data: {\n            interactionId: interaction.id,\n            ...(directOutcomeId ? { outcomeId: directOutcomeId } : {}),\n          },\n        });\n      }}''',
)

# Make the internal Response -> Input step explicit while leaving the master task
# Back/X semantics owned by the shared Author task shell.
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''{screen.type !== "overview" ? <button type="button" className="guided-back" onClick={back} aria-label="Back">[‹]</button> : null}''',
    '''{screen.type !== "overview" ? <button type="button" className="guided-back" onClick={back} aria-label="Back to input">[‹ INPUT]</button> : null}''',
)

# Flatten the Interaction overview around the two author intents: the player input
# itself and its Responses. Mode/configuration stays visible but no longer dominates.
replace_section(
    "src/features/narrative/author/InteractionEditor.tsx",
    "function InteractionOverview({\n",
    "function InputSettings",
    '''function InteractionOverview({\n  draft,\n  fallbackMode,\n  captureMode,\n  snapshot,\n  conversationCharacterId,\n  notationForOutcome,\n  autoFocusWording,\n  onWording,\n  onMatchMode,\n  onOpenResponse,\n  onAddResponse,\n  onOpenSettings,\n}: {\n  draft: Interaction;\n  fallbackMode: boolean;\n  captureMode: boolean;\n  snapshot: ProjectSnapshot;\n  conversationCharacterId: string | null;\n  notationForOutcome: (outcome: InteractionOutcome) => string;\n  autoFocusWording: boolean;\n  onWording: (wording: string) => void;\n  onMatchMode: (matchMode: "command" | "capture") => void;\n  onOpenResponse: (outcomeId: string) => void;\n  onAddResponse: () => void;\n  onOpenSettings: () => void;\n}) {\n  return <div className="interaction-overview">\n    {!fallbackMode ? <section className="guided-section interaction-primary-section">\n      <h3>PLAYER INPUT</h3>\n      {!captureMode ? <label className="user-input-field">PLAYER ENTERS\n        <input value={draft.wording} onChange={(event) => onWording(event.target.value)} autoFocus={autoFocusWording} enterKeyHint="done" />\n      </label> : <div className="guided-context-copy compact-copy">Accept otherwise-unmatched text at this Node and make it available to response effects.</div>}\n      <div className="interaction-mode-row" aria-label="Player input mode">\n        <span>MODE</span>\n        <button type="button" aria-pressed={!captureMode} onClick={() => onMatchMode("command")}>{!captureMode ? "[X]" : "[ ]"} SPECIFIC</button>\n        <button type="button" aria-pressed={captureMode} onClick={() => onMatchMode("capture")}>{captureMode ? "[X]" : "[ ]"} CAPTURE</button>\n      </div>\n    </section> : <div className="guided-context-copy compact-copy">Response used when player text does not match another valid input at this Node.</div>}\n\n    <section className="guided-section interaction-response-section">\n      <h3>RESPONSES</h3>\n      <div className="response-summary-list">\n        {draft.outcomes.map((outcome, index) => <button type="button" className="response-summary-row" key={outcome.id} onClick={() => onOpenResponse(outcome.id)}>\n          <span className={`response-summary-notation${outcome.authorStatus === "draft" ? " draft-input" : ""}`}>{notationForOutcome(outcome)}</span>\n          <span className="response-summary-content">\n            <strong>{index + 1}. {responseSnippet(outcome)}</strong>\n            <small>{responseSpeakerLabel(snapshot, outcome, conversationCharacterId)} · {conditionSummary(outcome.condition)} · {destinationLabel(snapshot, outcome)} · {outcome.effects.length} effect{outcome.effects.length === 1 ? "" : "s"}</small>\n          </span>\n          <span aria-hidden="true">›</span>\n        </button>)}\n      </div>\n      <button type="button" className="guided-add" onClick={onAddResponse}>[+ ADD RESPONSE]</button>\n    </section>\n\n    <section className="guided-section interaction-settings-summary">\n      <button type="button" className="guided-drill-row" onClick={onOpenSettings}>\n        <span>INPUT SETTINGS</span>\n        <span className="guided-row-value">{fallbackMode || captureMode ? "Author details" : "Aliases · visibility · details"}</span>\n        <span aria-hidden="true">›</span>\n      </button>\n    </section>\n  </div>;\n}\n\n''',
)

# Response authoring begins with prose immediately; the shared text editor carries
# its own lightweight delivery tools. Smaller rows keep both prose boxes near each
# other on mobile while desktop still gets the shared responsive two-column grid.
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    '''    <section className="guided-section response-writing-section">\n      <h3>RESPONSE</h3>''',
    '''    <section className="response-writing-section">''',
)
replace(
    "src/features/narrative/author/InteractionEditor.tsx",
    "          rows={5}",
    "          rows={4}",
    count=2,
)

# Shared prose editor: keep every capability, but attach speed/help/preview to the
# writing instead of reserving permanent vertical sections and a duplicate preview box.
replace(
    "src/features/narrative/author/AuthoredTextEditor.tsx",
    '''import { interpolateText } from "../interpolation";\nimport { compileTextNotation, validateTextNotation } from "../textNotation";''',
    '''import { validateTextNotation } from "../textNotation";''',
)
replace_section(
    "src/features/narrative/author/AuthoredTextEditor.tsx",
    '''  const renderedText = useMemo(\n''',
    '''  const featureCommands = featureTextCueAuthorAdapters();''',
    '''  const featureCommands = featureTextCueAuthorAdapters();''',
)
replace_section(
    "src/features/narrative/author/AuthoredTextEditor.tsx",
    '''  return <div className="authored-text-editor">''',
    '''function PerformanceText''',
    '''  return <div className="authored-text-editor">\n    <div className="authored-text-heading">\n      <span>{label}</span>\n      <label className="authored-text-speed">\n        <span>SPEED</span>\n        <input\n          type="number"\n          min={1}\n          max={120}\n          value={value.performance.charactersPerSecond}\n          aria-label={`${label} speed in characters per second`}\n          onChange={(event) => emit({\n            ...value,\n            performance: { ...value.performance, charactersPerSecond: Math.max(1, Math.min(120, Number(event.target.value) || 1)) },\n          })}\n        />\n        <span>cps</span>\n      </label>\n    </div>\n    <label className="authored-text-field">\n      <ValueMentionField\n        snapshot={snapshot}\n        playState={playState}\n        multiline\n        rows={rows}\n        textareaRef={textarea}\n        value={value.text}\n        onValueChange={(text) => emit({ ...value, text })}\n        onSelectionChange={setSelection}\n        autoFocus={autoFocus}\n        ariaLabel={label}\n      />\n    </label>\n    <div className="authored-text-tools">\n      <span className="authored-text-count">{value.text.length} char{value.text.length === 1 ? "" : "s"}</span>\n      <TextRulesReference\n        onApply={applyInlineRule}\n        featureCommands={featureCommands.map((adapter) => ({\n          code: adapter.inlineCode,\n          label: adapter.label,\n          category: adapter.category,\n          description: adapter.description,\n        }))}\n        onApplyFeatureCommand={applyFeatureCommand}\n      />\n      {onPreview ? <button type="button" className="authored-text-preview" disabled={Boolean(issues.length)} onClick={() => onPreview({\n        ...value,\n        performance: { ...value.performance, cues: [] },\n      })}>[PREVIEW]</button> : null}\n    </div>\n    {configuredCommands.length ? <section className="inline-command-configs" aria-label="Inline command details">\n      <strong>COMMAND DETAILS</strong>\n      {configuredCommands.map(({ command, adapter }, index) => adapter ? <div\n        className="inline-command-config-row"\n        key={`${command.definition.code}:${command.rawStart}`}\n      >\n        <div className="inline-command-config-heading">\n          <span><strong>{index + 1}. /{command.definition.code}</strong><small>{adapter.description}</small></span>\n          <button type="button" onClick={() => removeCommand(command.rawStart, command.rawEnd)}>[REMOVE]</button>\n        </div>\n        {adapter.renderValue?.({\n          value: command.value,\n          snapshot,\n          onValueChange: (nextValue) => updateCommandValue(command.rawEnd, command.valueStart, command.valueEnd, nextValue),\n        })}\n      </div> : null)}\n    </section> : null}\n    {issues.length ? <div className="authored-text-errors" role="alert">\n      {issues.map((issue) => <span key={`${issue.index}:${issue.message}`}>{issue.message}</span>)}\n    </div> : null}\n  </div>;\n}\n''',
)
# Drop the obsolete permanent preview renderer left after the replacement marker.
text = read("src/features/narrative/author/AuthoredTextEditor.tsx")
performance_at = text.find("function PerformanceText")
if performance_at >= 0:
    text = text[:performance_at]
write("src/features/narrative/author/AuthoredTextEditor.tsx", text)

# Shared prose presentation remains one component on desktop/mobile; only layout changes.
write("src/features/narrative/author/authoredTextEditor.css", '''.authored-text-editor {\n  display: grid;\n  gap: .4em;\n  min-width: 0;\n}\n\n.authored-text-heading,\n.authored-text-tools {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: .35em .75em;\n}\n\n.authored-text-heading {\n  justify-content: space-between;\n  min-height: 2em;\n}\n\n.authored-text-heading > span:first-child {\n  color: var(--dos-bright);\n}\n\n.authored-text-speed {\n  display: flex;\n  align-items: center;\n  gap: .3em;\n  color: var(--dos-muted);\n  font-size: .82em;\n}\n\n.authored-text-speed input {\n  width: 3.6em;\n  min-height: 2em;\n  padding: .15em .25em;\n}\n\n.authored-text-field,\n.authored-text-field .value-mention-field {\n  display: grid;\n  min-width: 0;\n}\n\n.authored-text-field textarea {\n  width: 100%;\n  min-height: 5.25em;\n  padding: .6em;\n  line-height: 1.3;\n  resize: vertical;\n  overflow-wrap: anywhere;\n}\n\n.authored-text-tools {\n  min-height: 2.2em;\n  color: var(--dos-muted);\n  font-size: .88em;\n}\n\n.authored-text-count {\n  margin-right: auto;\n}\n\n.authored-text-tools .text-rules-reference {\n  margin: 0;\n}\n\n.authored-text-preview {\n  min-height: 2.2em;\n  padding: .2em .1em !important;\n}\n\n.narrative-prose-grid {\n  display: grid;\n  gap: .8em;\n  min-width: 0;\n}\n\n.narrative-prose-grid.has-dialogue {\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));\n  align-items: start;\n}\n\n.narrative-prose-grid > * {\n  min-width: 0;\n}\n\n.authored-text-errors {\n  display: grid;\n  gap: .2em;\n  padding: .5em;\n  border: 1px solid var(--dos-warn);\n  color: var(--dos-warn);\n}\n\n.inline-command-configs {\n  display: grid;\n  gap: .5em;\n  padding: .65em;\n  border: 1px dotted var(--dos-line);\n}\n\n.inline-command-configs > strong {\n  color: var(--dos-muted);\n  font-weight: 400;\n}\n\n.inline-command-config-row {\n  display: grid;\n  gap: .45em;\n  min-width: 0;\n  padding: .55em 0 0;\n  border-top: 1px solid var(--dos-line);\n}\n\n.inline-command-config-row:first-of-type {\n  border-top: 0;\n  padding-top: 0;\n}\n\n.inline-command-config-heading {\n  display: flex;\n  align-items: start;\n  justify-content: space-between;\n  gap: .75em;\n}\n\n.inline-command-config-heading > span {\n  display: grid;\n  gap: .15em;\n  min-width: 0;\n}\n\n.inline-command-config-heading small {\n  color: var(--dos-muted);\n  overflow-wrap: anywhere;\n}\n\n.inline-command-config-row .author-reference-field {\n  min-width: 0;\n}\n\n@media (max-width: 700px), (pointer: coarse) {\n  .authored-text-field textarea {\n    min-height: 5em;\n    font-size: max(16px, 1em);\n  }\n\n  .authored-text-heading {\n    align-items: center;\n  }\n\n  .authored-text-tools {\n    gap: .35em .65em;\n  }\n\n  .inline-command-config-heading {\n    align-items: start;\n  }\n}\n''')

# Interaction visual hierarchy: compact input mode, prose first, concise summaries,
# sticky mobile save, and intrinsic-width notation instead of table-like gutters.
text = read("src/features/narrative/author/interactionEditor.css")
text = text.replace("  padding: .8em 0;", "  padding: .65em 0;")
text = text.replace("  grid-template-columns: auto minmax(0, 1fr) auto;", "  grid-template-columns: max-content minmax(0, 1fr) auto;")
text = text.replace('''.response-summary-notation {\n  min-width: 2.8em;\n  color: var(--dos-muted);\n}''', '''.response-summary-notation {\n  color: var(--dos-muted);\n  padding-right: .15em;\n}''')
insert_at = text.find(".response-summary-list,")
if insert_at < 0:
    raise SystemExit("interactionEditor.css: insertion marker not found")
addition = '''.compact-copy {\n  margin-bottom: .55em;\n}\n\n.interaction-mode-row {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: .3em .7em;\n  margin-top: .55em;\n  color: var(--dos-muted);\n}\n\n.interaction-mode-row button {\n  min-height: 2.35em;\n  padding: .25em .1em !important;\n}\n\n.interaction-mode-row button[aria-pressed="true"] {\n  color: var(--dos-bright) !important;\n}\n\n.interaction-response-section h3 {\n  color: var(--dos-bright);\n}\n\n.interaction-settings-summary {\n  padding-top: .45em;\n}\n\n.interaction-settings-summary .guided-drill-row {\n  border: 1px solid var(--dos-line) !important;\n}\n\n.response-writing-section {\n  padding: .1em 0 .65em;\n}\n\n'''
text = text[:insert_at] + addition + text[insert_at:]
mobile_marker = '''  .guided-editor-header {\n    position: sticky;\n    top: 0;\n    z-index: 2;\n  }\n'''
mobile_add = mobile_marker + '''\n  .guided-editor-footer {\n    position: sticky;\n    bottom: 0;\n    z-index: 7;\n    padding-bottom: max(.35em, env(safe-area-inset-bottom));\n    border-top: 1px solid var(--dos-line);\n    background: #000;\n  }\n\n  .interaction-mode-row {\n    gap: .25em .55em;\n  }\n'''
if mobile_marker not in text:
    raise SystemExit("interactionEditor.css: mobile marker not found")
text = text.replace(mobile_marker, mobile_add, 1)
write("src/features/narrative/author/interactionEditor.css", text)

# The live-play notation keeps a generous touch target but stops looking like a
# cramped table column; the wording remains the untouched player action.
replace(
    "src/features/narrative/author/authorInputSurface.css",
    '''  grid-template-columns: auto minmax(0, 1fr);''',
    '''  grid-template-columns: max-content minmax(0, 1fr);\n  column-gap: .25em;''',
)
replace(
    "src/features/narrative/author/authorInputSurface.css",
    '''.author-input-edit {\n  min-width: 3.35em;\n  padding-inline: .55em;\n  border-right: 1px dotted var(--dos-line) !important;\n  color: var(--dos-muted);\n  text-align: center;\n}''',
    '''.author-input-edit {\n  min-width: 2.75em;\n  padding-inline: .35em;\n  color: var(--dos-muted);\n  text-align: center;\n}''',
)

print("Author response mobile flow cleanup applied.")
