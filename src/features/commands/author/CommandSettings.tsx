import { useEffect, useState } from "react";
import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../../../author/features/types";
import { authorOperationDefinitions } from "../../../author/operations/catalog";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { APPLICATION_COMMAND_CAPABILITIES } from "../../../engine/application/catalog";
import type { ApplicationCommandCapability } from "../../../engine/application/capability";
import type { CommandDefinition, CommandProjectSettings, ReferenceSourceSetting } from "../model";
import { commandReferenceSourceByKind, commandReferenceSources } from "../referenceCatalog";
import "./commandSettings.css";

const OPERATION_ID_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const PLACEHOLDER_PATTERN = /\{([a-z][a-z0-9_-]*)\}/gi;
const CUSTOM_ACTION = "__custom__";

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

function applicationCapability(operation: string): ApplicationCommandCapability | undefined {
  return APPLICATION_COMMAND_CAPABILITIES.find((candidate) => candidate.operation === operation);
}

function actionLabel(command: CommandDefinition) {
  return applicationCapability(command.operation)?.label ?? command.operation;
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
    <button type="button" className="command-settings-create" onClick={() => context.pushTask({
      type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" },
    })}>[+ NEW PLAYER COMMAND]</button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>
      <span><strong>PLAYER COMMANDS</strong><small>Project-wide player inputs and what they do.</small></span>
      <span>{enabledCommands} ›</span>
    </button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "references" })}>
      <span><strong>TARGET NAMES + ALIASES</strong><small>Alternate names players can use for authored things.</small></span>
      <span>{enabledSources}/{referenceSources.length} ›</span>
    </button>
  </div>;
}

function PlayerInteractionsWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const node = context.snapshot.nodes.find((candidate) => candidate.id === context.playState.currentNodeId);
  const sceneInteractions = context.snapshot.interactions.filter((interaction) => interaction.sourceNodeId === context.playState.currentNodeId);
  const validInputs = sceneInteractions.filter((interaction) => interaction.matchMode !== "fallback");
  const invalidInput = sceneInteractions.find((interaction) => interaction.matchMode === "fallback");
  const otherTargetSources = commandReferenceSources().filter((source) =>
    source.kind !== "inventory.item" && context.resources.canOpenList(source.authorResourceKind));

  return <section className="author-panel author-panel-frame command-settings-workspace player-interactions-workspace">
    <header><span>PLAYER INTERACTIONS</span><span>PLAY + BUILD</span></header>
    <div className="author-panel-body command-settings-list">
      <h3>CURRENT SCENE · #{node?.nodeNumber ?? "?"}</h3>
      {validInputs.map((interaction) => <button type="button" key={interaction.id} onClick={() => context.pushTask({
        type: "feature", feature: "narrative", workspace: "interaction", data: { interactionId: interaction.id },
      })}>
        <span><strong>{interaction.wording || interaction.aliases[0] || "Untitled input"}</strong><small>{interaction.outcomes.length} response{interaction.outcomes.length === 1 ? "" : "s"}</small></span><span>›</span>
      </button>)}
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "narrative", workspace: "interaction" })}>
        <span><strong>+ CURRENT-SCENE INPUT</strong><small>Input that works only at this node.</small></span><span>›</span>
      </button>
      <button type="button" onClick={() => context.pushTask({
        type: "feature", feature: "narrative", workspace: "interaction", data: { ...(invalidInput ? { interactionId: invalidInput.id } : {}), fallback: "true" },
      })}>
        <span><strong>{invalidInput ? "INVALID INPUT RESPONSE" : "+ INVALID INPUT RESPONSE"}</strong><small>Response when nothing matches.</small></span><span>›</span>
      </button>

      <h3>PROJECT-WIDE</h3>
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>
        <span><strong>PLAYER COMMANDS</strong><small>Reusable typed commands.</small></span><span>{context.snapshot.settings.commands.commands.length} ›</span>
      </button>

      <h3>ITEM BEHAVIOR</h3>
      {context.snapshot.items.map((item) => <article className="player-interaction-target" key={item.id}>
        <button type="button" className="player-interaction-target-heading" onClick={() => context.resources.edit("item", item.id)}>
          <span><strong>{item.name || item.key || "Untitled item"}</strong><small>{(item.hooks ?? []).length} authored response{(item.hooks ?? []).length === 1 ? "" : "s"}</small></span><span>ALL ›</span>
        </button>
        <div className="player-interaction-operation-links">{authorOperationDefinitions(context.snapshot, "inventory.item").map((operation) => {
          const available = (item.operations ?? []).includes(operation.value);
          const responseCount = (item.hooks ?? []).filter((hook) => hook.operation === operation.value).length;
          return <button type="button" className={available ? "is-available" : ""} key={operation.value} onClick={() => context.resources.edit("item", item.id, undefined)}>{operation.label.toUpperCase()} · {available ? "ON" : "OFF"} · {responseCount}</button>;
        })}</div>
      </article>)}
      {!context.snapshot.items.length ? <div className="command-settings-empty">NO ITEMS YET.</div> : null}

      {otherTargetSources.length ? <>
        <h3>OTHER TARGET OWNERS</h3>
        {otherTargetSources.map((source) => <button type="button" key={source.kind} onClick={() => context.resources.openList(source.authorResourceKind)}>
          <span><strong>{source.label}</strong><small>{source.description}</small></span><span>›</span>
        </button>)}
      </> : null}
    </div>
  </section>;
}

function ReferenceSourcesWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const referenceSources = commandReferenceSources();
  const configured = context.snapshot.settings.commands.referenceSources;
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>TARGET NAMES + ALIASES</span><span>{configured.filter((source) => source.enabled).length} ENABLED</span></header>
    <div className="author-panel-body command-settings-list">
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

  const save = async (): Promise<boolean> => {
    if (!source) return false;
    setSaving(true);
    try {
      const commands = updateReferenceSetting(context.snapshot.settings.commands, draft);
      const result = await persistCommands(context, commands, `Changed ${source.label} terminal references`);
      if (result.status === "saved" || result.status === "queued") {
        setBaseline(JSON.stringify(draft));
        context.setWorkspaceDirty(false);
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    context.registerWorkspaceSave(source ? save : null);
    return () => context.registerWorkspaceSave(null);
  });

  if (!source) return <section className="author-panel author-panel-frame"><header>REFERENCE SOURCE</header><p>UNKNOWN SOURCE.</p></section>;

  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>TARGET NAMES · {source.label}</span></header>
    <div className="author-panel-body command-reference-editor">
      <label className="check-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> recognize this target type</label>
      <label className="check-label"><input type="checkbox" checked={draft.includeDefaults} onChange={(event) => setDraft({ ...draft, includeDefaults: event.target.checked })} /> use normal names / labels / keys / tags</label>
      <h3>CUSTOM ALIASES</h3>
      <div className="command-reference-candidates">
        {candidates.map((candidate) => <div className="command-reference-candidate" key={candidate.id}>
          <div className="command-reference-candidate-heading">
            <span>{candidate.label}</span>
            <button type="button" onClick={() => context.resources.edit(source.authorResourceKind, candidate.id)}>[EDIT]</button>
          </div>
          <label>ADDITIONAL NAMES
            <textarea
              rows={2}
              value={(draft.aliases[candidate.id] ?? []).join("\n")}
              placeholder="one additional name per line"
              onChange={(event) => setDraft({
                ...draft,
                aliases: { ...draft.aliases, [candidate.id]: patternLines(event.target.value) },
              })}
            />
          </label>
        </div>)}
        {!candidates.length ? <span className="muted">No targets currently exist for this type.</span> : null}
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
      {commands.map((command) => <button type="button" key={command.id} onClick={() => context.pushTask({
        type: "feature",
        feature: "commands",
        workspace: "command",
        data: { commandId: command.id },
      })}>
        <span>
          <strong>{command.label || command.operation}</strong>
          <small>{command.patterns.join(" · ") || "no player inputs"}</small>
          <small>ACTION · {actionLabel(command)}</small>
        </span>
        <span>{command.enabled ? "ON" : "OFF"} ›</span>
      </button>)}
      {!commands.length ? <div className="command-settings-empty">NO PLAYER COMMANDS.</div> : null}
    </div>
    <div className="author-actions author-panel-footer"><button type="button" onClick={() => context.pushTask({
      type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" },
    })}>[+ PLAYER COMMAND]</button></div>
  </section>;
}

function CommandEditor({ context, commandId, initialOperation = "", resourceTask }: { context: AuthorWorkspaceContext; commandId: string; initialOperation?: string; resourceTask?: string }) {
  const existing = context.snapshot.settings.commands.commands.find((command) => command.id === commandId);
  const initialCapability = applicationCapability(initialOperation);
  const initial: CommandDefinition = structuredClone(existing ?? {
    id: crypto.randomUUID(),
    label: initialCapability?.label ?? "",
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
  const [pendingSourceKinds, setPendingSourceKinds] = useState<string[]>([]);
  const currentForDirty = { ...draft, patterns: patternLines(patternsText) };
  const dirty = JSON.stringify(currentForDirty) !== baseline || pendingSourceKinds.length > 0;
  const slotNames = placeholderNames(currentForDirty.patterns);
  const availableSources = commandReferenceSources();
  const selectedCapability = applicationCapability(draft.operation);
  const enabledSourceKinds = new Set([
    ...context.snapshot.settings.commands.referenceSources
      .filter((source) => source.enabled)
      .map((source) => source.sourceKind),
    ...pendingSourceKinds,
  ]);
  const savedCommand = context.snapshot.settings.commands.commands.find((candidate) => candidate.id === draft.id);
  const savedTarget = savedCommand?.targetSlot ? savedCommand.slots.find((slot) => slot.name === savedCommand.targetSlot) : undefined;

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const syncSlots = (patterns: string[], current: CommandDefinition["slots"]) => {
    const names = placeholderNames(patterns);
    return names.map((name) => current.find((slot) => slot.name === name) ?? { name, sourceKind: "text" });
  };

  const save = async (): Promise<boolean> => {
    const patterns = patternLines(patternsText);
    const operation = draft.operation.trim();
    if (!draft.label.trim() || !OPERATION_ID_PATTERN.test(operation) || !patterns.length) return false;
    const command: CommandDefinition = {
      ...draft,
      label: draft.label.trim(),
      operation,
      patterns,
      slots: syncSlots(patterns, draft.slots),
      targetSlot: slotNames.includes(draft.targetSlot) ? draft.targetSlot : "",
    };
    const current = context.snapshot.settings.commands.commands;
    let commands: CommandProjectSettings = {
      ...context.snapshot.settings.commands,
      commands: current.some((candidate) => candidate.id === command.id)
        ? current.map((candidate) => candidate.id === command.id ? command : candidate)
        : [...current, command],
    };
    for (const sourceKind of pendingSourceKinds) {
      const setting = referenceSetting(commands, sourceKind);
      commands = updateReferenceSetting(commands, { ...setting, enabled: true });
    }
    setSaving(true);
    try {
      const result = await persistCommands(context, commands, `${existing ? "Changed" : "Created"} command ${command.label}`);
      if (result.status === "saved" || result.status === "queued") {
        setDraft(command);
        setPatternsText(command.patterns.join("\n"));
        setBaseline(JSON.stringify(command));
        setPendingSourceKinds([]);
        context.setWorkspaceDirty(false);
        if (resourceTask) context.completeTask({
          type: "resource",
          kind: resourceTask,
          id: command.id,
          value: command.id,
          label: command.label || command.operation,
        });
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    context.registerWorkspaceSave(save);
    return () => context.registerWorkspaceSave(null);
  });

  const stageSource = (sourceKind: string) => {
    if (!commandReferenceSourceByKind(sourceKind) || enabledSourceKinds.has(sourceKind)) return;
    setPendingSourceKinds((current) => current.includes(sourceKind) ? current : [...current, sourceKind]);
  };

  const remove = async () => {
    if (!savedCommand) return;
    const commands: CommandProjectSettings = {
      ...context.snapshot.settings.commands,
      commands: context.snapshot.settings.commands.commands.filter((candidate) => candidate.id !== savedCommand.id),
    };
    const result = await persistCommands(context, commands, `Deleted command ${savedCommand.label}`);
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

  const chooseAction = (operation: string) => {
    if (operation === CUSTOM_ACTION) {
      setOperationTouched(false);
      setDraft({ ...draft, operation: operationIdFromLabel(draft.label) });
      return;
    }
    const capability = applicationCapability(operation);
    if (!capability) return;
    setOperationTouched(true);
    setDraft({
      ...draft,
      label: draft.label.trim() ? draft.label : capability.label,
      operation: capability.operation,
      targetSlot: "",
    });
  };

  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>PLAYER COMMAND · {draft.label || "NEW"}</span></header>
    <div className="author-panel-body command-editor-body">
      <label>COMMAND NAME
        <input value={draft.label} autoFocus={!existing} onChange={(event) => {
          const label = event.target.value;
          setDraft({
            ...draft,
            label,
            operation: !selectedCapability && !operationTouched ? operationIdFromLabel(label) : draft.operation,
          });
        }} />
      </label>
      <label className="check-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> enabled</label>
      <label>PLAYER INPUTS · ONE PER LINE
        <textarea rows={5} value={patternsText} onChange={(event) => updatePatterns(event.target.value)} placeholder={"save\nsave game"} />
      </label>
      <label>ACTION
        <select value={selectedCapability?.operation ?? CUSTOM_ACTION} onChange={(event) => chooseAction(event.target.value)}>
          <option value={CUSTOM_ACTION}>CUSTOM / TARGET ACTION</option>
          {APPLICATION_COMMAND_CAPABILITIES.map((capability) => <option key={capability.operation} value={capability.operation}>{capability.label}</option>)}
        </select>
        {selectedCapability ? <small>{selectedCapability.description}</small> : null}
      </label>
      {!selectedCapability ? <label>ACTION ID
        <input value={draft.operation} onChange={(event) => {
          setOperationTouched(true);
          setDraft({ ...draft, operation: event.target.value.toLowerCase() });
        }} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="polish" />
        <small>Used to connect this wording to target behavior or another module.</small>
      </label> : null}
      {draft.slots.length ? <div className="command-slot-editor">
        <h3>INPUT PARTS</h3>
        {draft.slots.map((slot) => <label key={slot.name}><span>{`{${slot.name}}`}</span>
          <select value={slot.sourceKind} onChange={(event) => setDraft({
            ...draft,
            slots: draft.slots.map((candidate) => candidate.name === slot.name ? { ...candidate, sourceKind: event.target.value } : candidate),
          })}>
            <option value="text">FREE TEXT</option>
            {availableSources.map((source) => <option key={source.kind} value={source.kind}>{source.label}{enabledSourceKinds.has(source.kind) ? "" : " · OFF"}</option>)}
          </select>
          {slot.sourceKind !== "text" && !enabledSourceKinds.has(slot.sourceKind)
            ? <small className="command-slot-source-warning">{commandReferenceSourceByKind(slot.sourceKind)?.label ?? slot.sourceKind} is off. <button type="button" onClick={() => stageSource(slot.sourceKind)}>[ENABLE WITH SAVE]</button></small>
            : pendingSourceKinds.includes(slot.sourceKind)
              ? <small className="command-slot-source-warning">Will be enabled when this command is saved.</small>
              : null}
        </label>)}
        <label>TARGET
          <select value={draft.targetSlot} onChange={(event) => setDraft({ ...draft, targetSlot: event.target.value })}>
            <option value="">NO TARGET</option>
            {draft.slots.filter((slot) => slot.sourceKind !== "text").map((slot) => <option key={slot.name} value={slot.name}>{`{${slot.name}}`}</option>)}
          </select>
        </label>
      </div> : null}
      {savedCommand ? <div className="command-delete-zone">
        {savedTarget && savedTarget.sourceKind !== "text" ? <button type="button" onClick={() => context.pushTask({
          type: "feature",
          feature: "commands",
          workspace: "target-behaviors",
          data: { sourceKind: savedTarget.sourceKind, operation: savedCommand.operation, commandLabel: savedCommand.label },
        })}>[DEFINE TARGET BEHAVIOR]</button> : null}
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
  const adapter = context.resolveCommandTarget(sourceKind);
  const targets = adapter?.list(context.snapshot, operation) ?? [];
  return <section className="author-panel author-panel-frame command-settings-workspace target-behaviors-workspace">
    <header><span>{commandLabel || operation.toUpperCase()} · TARGET BEHAVIOR</span></header>
    <div className="author-panel-body command-settings-list">
      {targets.map((target) => <button type="button" key={target.id} onClick={() => adapter && context.pushTask(adapter.editRoute(target.id, operation))}>
        <span><strong>{target.label}</strong><small>{target.available ? "available" : "not available"} · {target.responseCount} response{target.responseCount === 1 ? "" : "s"}{target.detail ? ` · ${target.detail}` : ""}</small></span><span>›</span>
      </button>)}
      {!adapter ? <div className="command-settings-empty">NO AUTHORING ROUTE FOR THIS TARGET TYPE.</div> : null}
      {adapter && !targets.length ? <div className="command-settings-empty">NO {adapter.label.toUpperCase()}S EXIST YET.</div> : null}
    </div>
    {adapter?.createRoute ? <div className="author-actions author-panel-footer"><button type="button" onClick={() => context.pushTask(adapter.createRoute!(operation))}>[+ CREATE {adapter.label.toUpperCase()}]</button></div> : null}
  </section>;
}

export const COMMAND_PROJECT_SETTINGS_SECTION: readonly AuthorProjectSettingsSection[] = [
  {
    id: "commands",
    label: "PLAYER LANGUAGE",
    description: "Player commands and target names.",
    order: 20,
    render: (context) => <CommandsOverview context={context} />,
  },
];

export function renderCommandSettingsWorkspace(route: AuthorTaskRoute, context: AuthorWorkspaceContext) {
  if (route.type !== "feature" || route.feature !== "commands") return null;
  if (route.workspace === "references") return <ReferenceSourcesWorkspace context={context} />;
  if (route.workspace === "reference-source") return <ReferenceSourceEditor context={context} sourceKind={route.data?.sourceKind ?? ""} />;
  if (route.workspace === "grammar" || route.workspace === "capabilities") return <CommandGrammarWorkspace context={context} />;
  if (route.workspace === "command") return <CommandEditor context={context} commandId={route.data?.commandId ?? "new"} initialOperation={route.data?.operation ?? ""} resourceTask={route.data?.resourceTask} />;
  if (route.workspace === "interactions") return <PlayerInteractionsWorkspace context={context} />;
  if (route.workspace === "target-behaviors") return <TargetBehaviorsWorkspace
    context={context}
    sourceKind={route.data?.sourceKind ?? ""}
    operation={route.data?.operation ?? ""}
    commandLabel={route.data?.commandLabel ?? ""}
  />;
  return null;
}
