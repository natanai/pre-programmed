import { useEffect, useMemo, useState } from "react";
import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../../../author/features/types";
import type { AuthorPanelRoute } from "../../../author/workSurfaceNavigation";
import { APPLICATION_COMMAND_CAPABILITIES } from "../../../engine/application/catalog";
import { COMMAND_REFERENCE_SOURCES, COMMAND_REFERENCE_SOURCE_BY_KIND } from "../referenceCatalog";
import type { CommandDefinition, CommandProjectSettings, ReferenceSourceSetting } from "../model";
import "./commandSettings.css";

const OPERATION_ID_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const PLACEHOLDER_PATTERN = /\{([a-z][a-z0-9_-]*)\}/gi;

function operationIdFromLabel(label: string) {
  return label
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 64);
}

function patternLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function placeholderNames(patterns: string[]) {
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const match of pattern.matchAll(PLACEHOLDER_PATTERN)) seen.add(match[1].toLowerCase());
  }
  return [...seen];
}

function referenceSetting(commands: CommandProjectSettings, sourceKind: string): ReferenceSourceSetting {
  return structuredClone(commands.referenceSources.find((setting) => setting.sourceKind === sourceKind) ?? {
    sourceKind,
    enabled: false,
    includeDefaults: true,
    aliases: {},
  });
}

function updateReferenceSetting(commands: CommandProjectSettings, setting: ReferenceSourceSetting): CommandProjectSettings {
  return {
    ...commands,
    referenceSources: commands.referenceSources.some((candidate) => candidate.sourceKind === setting.sourceKind)
      ? commands.referenceSources.map((candidate) => candidate.sourceKind === setting.sourceKind ? setting : candidate)
      : [...commands.referenceSources, setting],
  };
}

async function persistCommands(context: AuthorWorkspaceContext, commands: CommandProjectSettings, description: string) {
  return context.persist([
    { type: "project.settings", settings: { ...context.snapshot.settings, commands } },
  ], description);
}

function CommandsOverview({ context }: { context: AuthorWorkspaceContext }) {
  const enabledSources = context.snapshot.settings.commands.referenceSources.filter((source) => source.enabled).length;
  const enabledCommands = context.snapshot.settings.commands.commands.filter((command) => command.enabled).length;
  return <div className="command-settings-overview">
    <button type="button" onClick={() => context.pushPanel({ type: "feature", feature: "commands", workspace: "references" })}>
      <span><strong>REFERENCE SOURCES</strong><small>Choose what players can refer to and which words identify each target.</small></span>
      <span>{enabledSources}/{COMMAND_REFERENCE_SOURCES.length} ›</span>
    </button>
    <button type="button" onClick={() => context.pushPanel({ type: "feature", feature: "commands", workspace: "grammar" })}>
      <span><strong>COMMAND GRAMMAR</strong><small>Define operations, aliases, argument slots, and accepted input shapes.</small></span>
      <span>{enabledCommands} ›</span>
    </button>
    <button type="button" onClick={() => context.pushPanel({ type: "feature", feature: "commands", workspace: "capabilities" })}>
      <span><strong>ENGINE CAPABILITIES</strong><small>Browse module-provided actions and create your own player-facing language for them.</small></span>
      <span>{APPLICATION_COMMAND_CAPABILITIES.length} ›</span>
    </button>
    <p className="command-settings-note">
      No traditional adventure-game verbs are required. A location can be entered as <code>{"{location}"}</code>, <code>go {"{location}"}</code>, or any authored pattern.
    </p>
  </div>;
}

function ReferenceSourcesWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const configured = context.snapshot.settings.commands.referenceSources;
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>REFERENCE SOURCES</span><span>{configured.filter((source) => source.enabled).length} ENABLED</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">Reference sources are feature-owned. Enabling one makes it available to command slots; it does not assign any verb.</p>
      {COMMAND_REFERENCE_SOURCES.map((source) => {
        const setting = configured.find((candidate) => candidate.sourceKind === source.kind);
        const count = source.candidates(context.snapshot, context.playState).length;
        return <button type="button" key={source.kind} onClick={() => context.pushPanel({
          type: "feature",
          feature: "commands",
          workspace: "reference-source",
          data: { sourceKind: source.kind },
        })}>
          <span><strong>{source.label}</strong><small>{source.description}</small></span>
          <span>{setting?.enabled ? "ON" : "OFF"} · {count} ›</span>
        </button>;
      })}
    </div>
  </section>;
}

function ReferenceSourceEditor({ context, sourceKind }: { context: AuthorWorkspaceContext; sourceKind: string }) {
  const source = COMMAND_REFERENCE_SOURCE_BY_KIND[sourceKind];
  const initial = referenceSetting(context.snapshot.settings.commands, sourceKind);
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const candidates = source?.candidates(context.snapshot, context.playState) ?? [];

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  if (!source) return <section className="author-panel author-panel-frame"><header>REFERENCE SOURCE</header><p>UNKNOWN SOURCE.</p></section>;

  const save = async () => {
    setSaving(true);
    try {
      const commands = updateReferenceSetting(context.snapshot.settings.commands, draft);
      const result = await persistCommands(context, commands, `Changed ${source.label} terminal references`);
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(draft));
        context.setWorkspaceDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>REFERENCES · {source.label}</span></header>
    <div className="author-panel-body command-reference-editor">
      <p className="command-settings-note">{source.description}</p>
      <label className="check-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> enable this reference source</label>
      <label className="check-label"><input type="checkbox" checked={draft.includeDefaults} onChange={(event) => setDraft({ ...draft, includeDefaults: event.target.checked })} /> accept normal names / labels / keys / tags supplied by this module</label>
      <h3>CUSTOM TARGET ALIASES</h3>
      <p className="command-settings-note">Optional. One alias per line. Turn off normal names above if you want only your own vocabulary.</p>
      <div className="command-reference-candidates">
        {candidates.map((candidate) => <label key={candidate.id}>
          <span>{candidate.label}</span>
          <textarea
            rows={2}
            value={(draft.aliases[candidate.id] ?? []).join("\n")}
            placeholder="additional words or phrases"
            onChange={(event) => setDraft({
              ...draft,
              aliases: { ...draft.aliases, [candidate.id]: patternLines(event.target.value) },
            })}
          />
        </label>)}
        {!candidates.length ? <span className="muted">No targets currently exist for this source.</span> : null}
      </div>
    </div>
    <div className="author-actions author-panel-footer"><button type="button" disabled={!dirty || saving} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button></div>
  </section>;
}

function CommandGrammarWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const commands = context.snapshot.settings.commands.commands;
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>COMMAND GRAMMAR</span><span>{commands.length} COMMANDS</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">Commands are project-wide grammar. Local node interactions still handle exact scene-specific phrases.</p>
      {commands.map((command) => <button type="button" key={command.id} onClick={() => context.pushPanel({
        type: "feature",
        feature: "commands",
        workspace: "command",
        data: { commandId: command.id },
      })}>
        <span><strong>{command.label || command.operation}</strong><small>{command.patterns.join(" · ") || "no patterns"}</small></span>
        <span>{command.enabled ? "ON" : "OFF"} ›</span>
      </button>)}
      {!commands.length ? <div className="command-settings-empty">NO PROJECT COMMANDS YET.</div> : null}
    </div>
    <div className="author-actions author-panel-footer"><button type="button" onClick={() => context.pushPanel({
      type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" },
    })}>[+ COMMAND]</button></div>
  </section>;
}

function CapabilitiesWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>ENGINE CAPABILITIES</span><span>{APPLICATION_COMMAND_CAPABILITIES.length}</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">Capabilities are actions supplied by engine modules. They have no mandatory player-facing words. Create a command, then choose whatever language fits this game.</p>
      {APPLICATION_COMMAND_CAPABILITIES.map((capability) => <button type="button" key={capability.operation} onClick={() => context.pushPanel({
        type: "feature",
        feature: "commands",
        workspace: "command",
        data: { commandId: "new", operation: capability.operation },
      })}>
        <span><strong>{capability.label}</strong><small>{capability.description}</small></span>
        <span>{capability.operation} ›</span>
      </button>)}
      {!APPLICATION_COMMAND_CAPABILITIES.length ? <div className="command-settings-empty">NO APPLICATION CAPABILITIES ARE INSTALLED.</div> : null}
    </div>
  </section>;
}

function CommandEditor({ context, commandId, initialOperation = "" }: { context: AuthorWorkspaceContext; commandId: string; initialOperation?: string }) {
  const existing = context.snapshot.settings.commands.commands.find((command) => command.id === commandId);
  const capability = APPLICATION_COMMAND_CAPABILITIES.find((candidate) => candidate.operation === initialOperation);
  const initial: CommandDefinition = structuredClone(existing ?? {
    id: crypto.randomUUID(),
    label: capability?.label ?? "",
    operation: initialOperation,
    enabled: true,
    patterns: [],
    slots: [],
    targetSlot: "",
  });
  const [draft, setDraft] = useState(initial);
  const [patternsText, setPatternsText] = useState(initial.patterns.join("\n"));
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [operationTouched, setOperationTouched] = useState(Boolean(existing || initialOperation));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const currentForDirty = { ...draft, patterns: patternLines(patternsText) };
  const dirty = JSON.stringify(currentForDirty) !== baseline;
  const slotNames = placeholderNames(currentForDirty.patterns);
  const availableSources = COMMAND_REFERENCE_SOURCES;

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const syncSlots = (patterns: string[], current: CommandDefinition["slots"]) => {
    const names = placeholderNames(patterns);
    return names.map((name) => current.find((slot) => slot.name === name) ?? { name, sourceKind: "text" });
  };

  const save = async () => {
    const patterns = patternLines(patternsText);
    const operation = draft.operation.trim();
    if (!draft.label.trim() || !OPERATION_ID_PATTERN.test(operation) || !patterns.length) return;
    const command: CommandDefinition = {
      ...draft,
      label: draft.label.trim(),
      operation,
      patterns,
      slots: syncSlots(patterns, draft.slots),
      targetSlot: slotNames.includes(draft.targetSlot) ? draft.targetSlot : "",
    };
    const current = context.snapshot.settings.commands.commands;
    const commands = {
      ...context.snapshot.settings.commands,
      commands: current.some((candidate) => candidate.id === command.id)
        ? current.map((candidate) => candidate.id === command.id ? command : candidate)
        : [...current, command],
    };
    setSaving(true);
    try {
      const result = await persistCommands(context, commands, `${existing ? "Changed" : "Created"} command ${command.label}`);
      if (result.status === "saved" || result.status === "queued") {
        setDraft(command);
        setPatternsText(command.patterns.join("\n"));
        setBaseline(JSON.stringify(command));
        context.setWorkspaceDirty(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const commands = {
      ...context.snapshot.settings.commands,
      commands: context.snapshot.settings.commands.commands.filter((candidate) => candidate.id !== existing.id),
    };
    const result = await persistCommands(context, commands, `Deleted command ${existing.label}`);
    if (result.status === "saved" || result.status === "queued") {
      context.setWorkspaceDirty(false);
      context.leaveCurrentSurface();
    }
  };

  const updatePatterns = (value: string) => {
    const patterns = patternLines(value);
    setPatternsText(value);
    const slots = syncSlots(patterns, draft.slots);
    setDraft({
      ...draft,
      slots,
      targetSlot: slots.some((slot) => slot.name === draft.targetSlot) ? draft.targetSlot : "",
    });
  };

  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>COMMAND · {draft.label || "NEW"}</span></header>
    <div className="author-panel-body command-editor-body">
      <label>NAME
        <input value={draft.label} autoFocus onChange={(event) => {
          const label = event.target.value;
          setDraft({ ...draft, label, operation: operationTouched ? draft.operation : operationIdFromLabel(label) });
        }} />
      </label>
      <label className="check-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> enabled</label>
      <label>OPERATION ID
        <input list="engine-capability-operation-ids" value={draft.operation} onChange={(event) => { setOperationTouched(true); setDraft({ ...draft, operation: event.target.value.toLowerCase() }); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <datalist id="engine-capability-operation-ids">{APPLICATION_COMMAND_CAPABILITIES.map((candidate) => <option key={candidate.operation} value={candidate.operation}>{candidate.label}</option>)}</datalist>
        <small>Stable engine operation ID. Use an installed capability or any authored/module ID such as examine, go, combat.attack.</small>
      </label>
      <label>PATTERNS · ONE PER LINE
        <textarea rows={5} value={patternsText} onChange={(event) => updatePatterns(event.target.value)} placeholder={"{location}\ngo {location}\nwalk to {location}"} />
        <small>Literal words are matched as written. Braced names create argument slots.</small>
      </label>
      {draft.slots.length ? <div className="command-slot-editor">
        <h3>ARGUMENT SLOTS</h3>
        {draft.slots.map((slot) => <label key={slot.name}><span>{`{${slot.name}}`}</span>
          <select value={slot.sourceKind} onChange={(event) => setDraft({
            ...draft,
            slots: draft.slots.map((candidate) => candidate.name === slot.name ? { ...candidate, sourceKind: event.target.value } : candidate),
          })}>
            <option value="text">FREE TEXT</option>
            {availableSources.map((source) => <option key={source.kind} value={source.kind}>{source.label}</option>)}
          </select>
        </label>)}
        <label>PRIMARY TARGET
          <select value={draft.targetSlot} onChange={(event) => setDraft({ ...draft, targetSlot: event.target.value })}>
            <option value="">NONE / APPLICATION OR META COMMAND</option>
            {draft.slots.filter((slot) => slot.sourceKind !== "text").map((slot) => <option key={slot.name} value={slot.name}>{`{${slot.name}}`}</option>)}
          </select>
          <small>The resolved target that receives this operation. With no target, an installed application capability can handle the operation.</small>
        </label>
      </div> : null}
      {existing ? <div className="command-delete-zone">
        {confirmDelete
          ? <><span>DELETE THIS COMMAND?</span><button type="button" onClick={() => void remove()}>[DELETE]</button><button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button></>
          : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE COMMAND]</button>}
      </div> : null}
    </div>
    <div className="author-actions author-panel-footer"><button type="button" disabled={!dirty || saving || !draft.label.trim() || !OPERATION_ID_PATTERN.test(draft.operation) || !patternLines(patternsText).length} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button></div>
  </section>;
}

export const COMMAND_PROJECT_SETTINGS_SECTION: readonly AuthorProjectSettingsSection[] = [
  {
    id: "commands",
    label: "COMMANDS + REFERENCES",
    description: "Define what players can refer to and the project-wide grammar that maps their text to operations.",
    order: 20,
    render: (context) => <CommandsOverview context={context} />,
  },
];

export function renderCommandSettingsWorkspace(route: AuthorPanelRoute, context: AuthorWorkspaceContext) {
  if (route.type !== "feature" || route.feature !== "commands") return null;
  if (route.workspace === "references") return <ReferenceSourcesWorkspace context={context} />;
  if (route.workspace === "reference-source") return <ReferenceSourceEditor context={context} sourceKind={route.data?.sourceKind ?? ""} />;
  if (route.workspace === "grammar") return <CommandGrammarWorkspace context={context} />;
  if (route.workspace === "capabilities") return <CapabilitiesWorkspace context={context} />;
  if (route.workspace === "command") return <CommandEditor context={context} commandId={route.data?.commandId ?? "new"} initialOperation={route.data?.operation ?? ""} />;
  return null;
}
