import { useEffect, useMemo, useState } from "react";
import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../../../author/features/types";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { APPLICATION_COMMAND_CAPABILITIES } from "../../../engine/application/catalog";
import { commandReferenceSourceByKind, commandReferenceSources } from "../referenceCatalog";
import type { CommandDefinition, CommandProjectSettings, ReferenceSourceSetting } from "../model";
import { authorOperationDefinitions } from "../../../author/operations/catalog";
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
  const referenceSources = commandReferenceSources();
  const enabledSources = context.snapshot.settings.commands.referenceSources.filter((source) => source.enabled).length;
  const enabledCommands = context.snapshot.settings.commands.commands.filter((command) => command.enabled).length;
  return <div className="command-settings-overview">
    <div className="command-settings-guide">
      <p><strong>PLAYER COMMAND</strong><span>What a player can type, what operation it attempts, and which target receives it.</span></p>
      <p><strong>TARGET NAME / ALIAS</strong><span>A word that identifies an existing item, character, location, variable, or computed value.</span></p>
      <p><strong>RESOURCE OPERATION</strong><span>What a particular resource can do. For example, edit an Item’s inspect/use/equip behavior under Inventory.</span></p>
    </div>
    <button type="button" className="command-settings-create" onClick={() => context.pushTask({
      type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" },
    })}>[+ NEW PLAYER COMMAND]</button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>
      <span><strong>PLAYER COMMANDS</strong><small>Create project-wide typed phrases such as <code>polish {"{item}"}</code> or <code>go {"{location}"}</code>.</small></span>
      <span>{enabledCommands} ›</span>
    </button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "references" })}>
      <span><strong>TARGET NAMES + ALIASES</strong><small>Choose which authored things commands can name and add alternate words for them.</small></span>
      <span>{enabledSources}/{referenceSources.length} ›</span>
    </button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "capabilities" })}>
      <span><strong>APPLICATION ACTIONS</strong><small>Connect player wording to module-provided, targetless actions such as opening Inventory.</small></span>
      <span>{APPLICATION_COMMAND_CAPABILITIES.length} ›</span>
    </button>
    <p className="command-settings-note">
      Item operations such as inspect, use, and equip are configured on each Item. They appear in Player Commands only when you author typed grammar that invokes them.
    </p>
  </div>;
}

function PlayerInteractionsWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const node = context.snapshot.nodes.find((candidate) => candidate.id === context.playState.currentNodeId);
  const sceneInteractions = context.snapshot.interactions.filter((interaction) => interaction.sourceNodeId === context.playState.currentNodeId);
  const validInputs = sceneInteractions.filter((interaction) => interaction.matchMode !== "fallback");
  const invalidInput = sceneInteractions.find((interaction) => interaction.matchMode === "fallback");

  return <section className="author-panel author-panel-frame command-settings-workspace player-interactions-workspace">
    <header><span>PLAYER INTERACTIONS</span><span>PLAY + BUILD</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">Start from what the player types or the thing they act on. Scene responses, reusable wording, and target behavior remain owned by their feature while this workspace connects the journey.</p>

      <h3>CURRENT SCENE · #{node?.nodeNumber ?? "?"}</h3>
      {validInputs.map((interaction) => <button type="button" key={interaction.id} onClick={() => context.pushTask({
        type: "feature", feature: "narrative", workspace: "interaction", data: { interactionId: interaction.id },
      })}>
        <span><strong>{interaction.wording || interaction.aliases[0] || "Untitled input"}</strong><small>{interaction.outcomes.length} response{interaction.outcomes.length === 1 ? "" : "s"}</small></span><span>›</span>
      </button>)}
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "narrative", workspace: "interaction" })}>
        <span><strong>+ CURRENT-SCENE INPUT</strong><small>Define text that is valid only here and what happens in response.</small></span><span>›</span>
      </button>
      <button type="button" onClick={() => context.pushTask({
        type: "feature", feature: "narrative", workspace: "interaction", data: { ...(invalidInput ? { interactionId: invalidInput.id } : {}), fallback: "true" },
      })}>
        <span><strong>{invalidInput ? "INVALID INPUT RESPONSE" : "+ INVALID INPUT RESPONSE"}</strong><small>What still happens when player text does not match.</small></span><span>›</span>
      </button>

      <h3>REUSABLE PLAYER LANGUAGE</h3>
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>
        <span><strong>PLAYER COMMANDS</strong><small>Create wording such as polish {"{item}"}, then continue directly into target behavior.</small></span><span>{context.snapshot.settings.commands.commands.length} ›</span>
      </button>

      <h3>ITEM BEHAVIOR</h3>
      {context.snapshot.items.map((item) => <article className="player-interaction-target" key={item.id}>
        <button type="button" className="player-interaction-target-heading" onClick={() => context.pushTask({
          type: "feature", feature: "inventory", workspace: "item", data: { itemId: item.id, section: "operations" },
        })}>
          <span><strong>{item.name || item.key || "Untitled item"}</strong><small>{(item.hooks ?? []).length} authored response{(item.hooks ?? []).length === 1 ? "" : "s"}</small></span><span>ALL ›</span>
        </button>
        <div className="player-interaction-operation-links">{authorOperationDefinitions(context.snapshot, "inventory.item").map((operation) => {
          const available = (item.operations ?? []).includes(operation.value);
          const responseCount = (item.hooks ?? []).filter((hook) => hook.operation === operation.value).length;
          return <button type="button" className={available ? "is-available" : ""} key={operation.value} onClick={() => context.pushTask({
            type: "feature", feature: "inventory", workspace: "item", data: { itemId: item.id, section: "operations", operation: operation.value },
          })}>{operation.label.toUpperCase()} · {available ? "ON" : "OFF"} · {responseCount}</button>;
        })}</div>
      </article>)}
      {!context.snapshot.items.length ? <div className="command-settings-empty">NO ITEMS YET.</div> : null}

      <h3>OTHER TARGET BEHAVIOR</h3>
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "state", workspace: "definitions" })}>
        <span><strong>PEOPLE, PLACES + STATE</strong><small>Configure operations and responses on characters, locations, and exposed status values.</small></span><span>›</span>
      </button>
    </div>
  </section>;
}

function ReferenceSourcesWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const referenceSources = commandReferenceSources();
  const configured = context.snapshot.settings.commands.referenceSources;
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>TARGET NAMES + ALIASES</span><span>{configured.filter((source) => source.enabled).length} ENABLED</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">Enable a target type when Player Commands should recognize its existing names. Open it to add alternate words. This does not create an operation or command by itself.</p>
      {referenceSources.map((source) => {
        const setting = configured.find((candidate) => candidate.sourceKind === source.kind);
        const count = source.candidates(context.snapshot, context.playState).length;
        return <button type="button" key={source.kind} onClick={() => context.pushTask({
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
  const source = commandReferenceSourceByKind(sourceKind);
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
    <header><span>TARGET NAMES · {source.label}</span></header>
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
    <header><span>PLAYER COMMANDS</span><span>{commands.length} {commands.length === 1 ? "COMMAND" : "COMMANDS"}</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">This list contains only project-wide typed commands. Inventory is currently the sole starter command. Item operations such as inspect, use, and equip remain on each Item unless you create player wording for them here.</p>
      {commands.map((command) => <button type="button" key={command.id} onClick={() => context.pushTask({
        type: "feature",
        feature: "commands",
        workspace: "command",
        data: { commandId: command.id },
      })}>
        <span><strong>{command.label || command.operation}</strong><small>{command.patterns.join(" · ") || "no player input patterns"}</small><small>{command.targetSlot ? "TARGETED" : "APPLICATION / NO TARGET"} · {command.operation}</small></span>
        <span>{command.enabled ? "ON" : "OFF"} ›</span>
      </button>)}
      {!commands.length ? <div className="command-settings-empty">NO PROJECT COMMANDS YET.</div> : null}
    </div>
    <div className="author-actions author-panel-footer"><button type="button" onClick={() => context.pushTask({
      type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" },
    })}>[+ PLAYER COMMAND]</button></div>
  </section>;
}

function CapabilitiesWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>APPLICATION ACTIONS</span><span>{APPLICATION_COMMAND_CAPABILITIES.length}</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">Capabilities are actions supplied by engine modules. They have no mandatory player-facing words. Create a command, then choose whatever language fits this game.</p>
      {APPLICATION_COMMAND_CAPABILITIES.map((capability) => <button type="button" key={capability.operation} onClick={() => context.pushTask({
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
  const [enablingSource, setEnablingSource] = useState("");
  const [continuedToTargets, setContinuedToTargets] = useState(Boolean(existing));
  const currentForDirty = { ...draft, patterns: patternLines(patternsText) };
  const dirty = JSON.stringify(currentForDirty) !== baseline;
  const slotNames = placeholderNames(currentForDirty.patterns);
  const availableSources = commandReferenceSources();
  const enabledSourceKinds = new Set(
    context.snapshot.settings.commands.referenceSources
      .filter((source) => source.enabled)
      .map((source) => source.sourceKind),
  );

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
        const target = command.targetSlot ? command.slots.find((slot) => slot.name === command.targetSlot) : undefined;
        if (!continuedToTargets && target && target.sourceKind !== "text") {
          setContinuedToTargets(true);
          context.pushTask({
            type: "feature",
            feature: "commands",
            workspace: "target-behaviors",
            data: { sourceKind: target.sourceKind, operation: command.operation, commandLabel: command.label },
          });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const enableSource = async (sourceKind: string) => {
    const source = commandReferenceSourceByKind(sourceKind);
    if (!source || enablingSource) return;
    setEnablingSource(sourceKind);
    try {
      const setting = referenceSetting(context.snapshot.settings.commands, sourceKind);
      await persistCommands(
        context,
        updateReferenceSetting(context.snapshot.settings.commands, { ...setting, enabled: true }),
        `Enabled ${source.label} player-command targets`,
      );
    } finally {
      setEnablingSource("");
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
      context.leaveCurrentTask();
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
    <header><span>PLAYER COMMAND · {draft.label || "NEW"}</span></header>
    <div className="author-panel-body command-editor-body">
      <p className="command-settings-note">Example: name the command “Polish,” add the pattern <code>polish {"{item}"}</code>, set <code>{"{item}"}</code> to Inventory Items, and make it the primary target. If Inventory Items is marked OFF, enable it under Target Names + Aliases.</p>
      <label>COMMAND NAME
        <input value={draft.label} autoFocus onChange={(event) => {
          const label = event.target.value;
          setDraft({ ...draft, label, operation: operationTouched ? draft.operation : operationIdFromLabel(label) });
        }} />
        <small>The author-facing name shown in this list. This is what was previously described as the command label.</small>
      </label>
      <label className="check-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> enabled</label>
      <label>PLAYER INPUT PATTERNS · ONE PER LINE
        <textarea rows={5} value={patternsText} onChange={(event) => updatePatterns(event.target.value)} placeholder={"{location}\ngo {location}\nwalk to {location}"} />
        <small>Literal words are matched as written. Braced names create argument slots.</small>
      </label>
      <label>OPERATION ID
        <input list="engine-capability-operation-ids" value={draft.operation} onChange={(event) => { setOperationTouched(true); setDraft({ ...draft, operation: event.target.value.toLowerCase() }); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <datalist id="engine-capability-operation-ids">{APPLICATION_COMMAND_CAPABILITIES.map((candidate) => <option key={candidate.operation} value={candidate.operation}>{candidate.label}</option>)}</datalist>
        <small>Stable engine action ID, generated from the command name unless you edit it. Examples: polish, examine, go, or combat.attack.</small>
      </label>
      {draft.slots.length ? <div className="command-slot-editor">
        <h3>ARGUMENT SLOTS</h3>
        {draft.slots.map((slot) => <label key={slot.name}><span>{`{${slot.name}}`}</span>
          <select value={slot.sourceKind} onChange={(event) => setDraft({
            ...draft,
            slots: draft.slots.map((candidate) => candidate.name === slot.name ? { ...candidate, sourceKind: event.target.value } : candidate),
          })}>
            <option value="text">FREE TEXT</option>
            {availableSources.map((source) => <option key={source.kind} value={source.kind}>{source.label}{enabledSourceKinds.has(source.kind) ? "" : " · OFF"}</option>)}
          </select>
          {slot.sourceKind !== "text" && !enabledSourceKinds.has(slot.sourceKind)
            ? <small className="command-slot-source-warning">{commandReferenceSourceByKind(slot.sourceKind)?.label ?? slot.sourceKind} is not recognized yet. <button type="button" disabled={Boolean(enablingSource)} onClick={() => void enableSource(slot.sourceKind)}>[{enablingSource === slot.sourceKind ? "ENABLING..." : `ENABLE HERE`}]</button></small>
            : null}
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

function TargetBehaviorsWorkspace({ context, sourceKind, operation, commandLabel }: {
  context: AuthorWorkspaceContext;
  sourceKind: string;
  operation: string;
  commandLabel: string;
}) {
  const isItem = sourceKind === "inventory.item";
  return <section className="author-panel author-panel-frame command-settings-workspace target-behaviors-workspace">
    <header><span>{commandLabel || operation.toUpperCase()} · TARGET BEHAVIOR</span></header>
    <div className="author-panel-body command-settings-list">
      <p className="command-settings-note">The player wording is ready. Choose a target to define what its {operation} operation says, changes, or triggers. Targets without a response can still reject the attempt or use feature-owned defaults.</p>
      {isItem ? context.snapshot.items.map((item) => {
        const enabled = (item.operations ?? []).includes(operation);
        const responses = (item.hooks ?? []).filter((hook) => hook.operation === operation).length;
        return <button type="button" key={item.id} onClick={() => context.pushTask({
          type: "feature", feature: "inventory", workspace: "item", data: { itemId: item.id, section: "operations", operation },
        })}>
          <span><strong>{item.name || item.key || "Untitled item"}</strong><small>{enabled ? "available" : "not available"} · {responses} response{responses === 1 ? "" : "s"}</small></span><span>›</span>
        </button>;
      }) : <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "state", workspace: "definitions" })}>
        <span><strong>OPEN TARGET DEFINITIONS</strong><small>Choose a character, location, or state value and add this operation’s response.</small></span><span>›</span>
      </button>}
      {isItem && !context.snapshot.items.length ? <div className="command-settings-empty">NO ITEMS EXIST YET.</div> : null}
    </div>
  </section>;
}

export const COMMAND_PROJECT_SETTINGS_SECTION: readonly AuthorProjectSettingsSection[] = [
  {
    id: "commands",
    label: "PLAYER LANGUAGE",
    description: "Create player commands, configure target names and aliases, and connect wording to engine actions.",
    order: 20,
    render: (context) => <CommandsOverview context={context} />,
  },
];

export function renderCommandSettingsWorkspace(route: AuthorTaskRoute, context: AuthorWorkspaceContext) {
  if (route.type !== "feature" || route.feature !== "commands") return null;
  if (route.workspace === "references") return <ReferenceSourcesWorkspace context={context} />;
  if (route.workspace === "reference-source") return <ReferenceSourceEditor context={context} sourceKind={route.data?.sourceKind ?? ""} />;
  if (route.workspace === "grammar") return <CommandGrammarWorkspace context={context} />;
  if (route.workspace === "capabilities") return <CapabilitiesWorkspace context={context} />;
  if (route.workspace === "command") return <CommandEditor context={context} commandId={route.data?.commandId ?? "new"} initialOperation={route.data?.operation ?? ""} />;
  if (route.workspace === "interactions") return <PlayerInteractionsWorkspace context={context} />;
  if (route.workspace === "target-behaviors") return <TargetBehaviorsWorkspace
    context={context}
    sourceKind={route.data?.sourceKind ?? ""}
    operation={route.data?.operation ?? ""}
    commandLabel={route.data?.commandLabel ?? ""}
  />;
  return null;
}
