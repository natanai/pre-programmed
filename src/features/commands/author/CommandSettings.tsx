import { useEffect, useState } from "react";
import type { AuthorProjectSettingsSection, AuthorWorkspaceContext } from "../../../author/features/types";
import { OutcomeEffectsEditor } from "../../../author/outcomes/OutcomeComposer";
import { ReferenceField } from "../../../author/resources/ReferenceField";
import type { AuthorTaskRoute } from "../../../author/tasks/types";
import { APPLICATION_COMMAND_CAPABILITIES } from "../../../engine/application/catalog";
import { normalizePlayerInput } from "../../../engine/input/normalize";
import { SEMANTIC_REFERENCE_PROVIDERS, semanticReferenceProvider } from "../../../engine/references/catalog";
import { AuthoredTextEditor } from "../../narrative/author/AuthoredTextEditor";
import type { CommandAction, CommandDefinition, CommandProjectSettings, CommandSlotDefinition, ReferenceSourceSetting } from "../model";
import "./commandSettings.css";

const OPERATION_ID_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;
const PLACEHOLDER_PATTERN = /\{([a-z][a-z0-9_-]*)\}/gi;
const RESPONSE_ACTION = "__response__";
const TARGET_ACTION = "__target__";

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

function patternHasSlot(pattern: string, slotName: string) {
  return placeholderNames([pattern]).includes(slotName.toLowerCase());
}

function targetProviders() {
  return SEMANTIC_REFERENCE_PROVIDERS.filter((provider) => provider.targetable);
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
  return context.persist([{ type: "project.settings", settings: { ...context.snapshot.settings, commands } }], description);
}

function actionChoice(action: CommandAction) {
  if (action.type === "response") return RESPONSE_ACTION;
  if (action.type === "target-operation") return TARGET_ACTION;
  return `application:${action.operation}`;
}

function actionLabel(action: CommandAction) {
  if (action.type === "response") return "Respond with text";
  if (action.type === "target-operation") return action.operation ? `Target · ${action.operation}` : "Target operation";
  return APPLICATION_COMMAND_CAPABILITIES.find((capability) => capability.operation === action.operation)?.label ?? action.operation;
}

function defaultResponseAction(): CommandAction {
  return {
    type: "response",
    responseText: "",
    responsePerformance: { charactersPerSecond: 18, cues: [] },
    speakerId: null,
    effects: [],
  };
}

function CommandsOverview({ context }: { context: AuthorWorkspaceContext }) {
  const enabledSources = context.snapshot.settings.commands.referenceSources.filter((source) => source.enabled).length;
  const enabledCommands = context.snapshot.settings.commands.commands.filter((command) => command.enabled).length;
  return <div className="command-settings-overview">
    <button type="button" className="command-settings-create" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" } })}>[+ NEW PLAYER COMMAND]</button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>
      <span><strong>PLAYER COMMANDS</strong><small>Project-wide player inputs and what they do.</small></span><span>{enabledCommands} ›</span>
    </button>
    <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "references" })}>
      <span><strong>TARGET NAMES + ALIASES</strong><small>Player vocabulary supplied by semantic target owners.</small></span><span>{enabledSources}/{targetProviders().length} ›</span>
    </button>
  </div>;
}

function PlayerInteractionsWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  return <section className="author-panel author-panel-frame command-settings-workspace player-interactions-workspace">
    <header><span>PLAYER INTERACTIONS</span><span>PROJECT-WIDE</span></header>
    <div className="author-panel-body command-settings-list">
      <h3>PLAYER COMMANDS</h3>
      <button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "grammar" })}>
        <span><strong>PLAYER COMMANDS</strong><small>Reusable typed commands that work across the game.</small></span><span>{context.snapshot.settings.commands.commands.length} ›</span>
      </button>
      <h3>TARGET OWNERS</h3>
      {targetProviders().map((provider) => <button
        type="button"
        key={provider.kind}
        disabled={!provider.authorResourceKind || !context.resources.canOpenList(provider.authorResourceKind)}
        onClick={() => provider.authorResourceKind && context.resources.openList(provider.authorResourceKind)}
      >
        <span><strong>{provider.label.toUpperCase()}</strong><small>{provider.description}</small></span><span>›</span>
      </button>)}
    </div>
  </section>;
}

function ReferenceSourcesWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const providers = targetProviders();
  const configured = context.snapshot.settings.commands.referenceSources;
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>TARGET NAMES + ALIASES</span><span>{configured.filter((source) => source.enabled).length} ENABLED</span></header>
    <div className="author-panel-body command-settings-list">
      {providers.map((provider) => {
        const setting = configured.find((candidate) => candidate.sourceKind === provider.kind);
        const count = provider.candidates({ snapshot: context.snapshot, state: context.playState }).length;
        return <button type="button" key={provider.kind} onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "reference-source", data: { sourceKind: provider.kind } })}>
          <span><strong>{provider.label.toUpperCase()}</strong><small>{provider.description}</small></span><span>{setting?.enabled ? "ON" : "OFF"} · {count} ›</span>
        </button>;
      })}
    </div>
  </section>;
}

function ReferenceSourceEditor({ context, sourceKind }: { context: AuthorWorkspaceContext; sourceKind: string }) {
  const provider = semanticReferenceProvider(sourceKind);
  const initial = referenceSetting(context.snapshot.settings.commands, sourceKind);
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const candidates = provider?.candidates({ snapshot: context.snapshot, state: context.playState }) ?? [];

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const save = async (): Promise<boolean> => {
    if (!provider) return false;
    setSaving(true);
    try {
      const result = await persistCommands(context, updateReferenceSetting(context.snapshot.settings.commands, draft), `Changed ${provider.label} player vocabulary`);
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
    context.registerWorkspaceSave(provider ? save : null);
    return () => context.registerWorkspaceSave(null);
  });

  if (!provider) return <section className="author-panel author-panel-frame"><header>REFERENCE SOURCE</header><p>UNKNOWN SOURCE.</p></section>;

  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>TARGET NAMES · {provider.label.toUpperCase()}</span></header>
    <div className="author-panel-body command-reference-editor">
      <label className="check-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> recognize this target type</label>
      <label className="check-label"><input type="checkbox" checked={draft.includeDefaults} onChange={(event) => setDraft({ ...draft, includeDefaults: event.target.checked })} /> use owner-supplied names / keys / tags / contextual aliases</label>
      <h3>CUSTOM ALIASES</h3>
      <div className="command-reference-candidates">
        {candidates.map((candidate) => <div className="command-reference-candidate" key={candidate.id}>
          <div className="command-reference-candidate-heading">
            <span>{candidate.label}{candidate.detail ? <small>{candidate.detail}</small> : null}</span>
            {candidate.author && context.resources.canEdit(candidate.author.resourceKind, candidate.author.resourceId)
              ? <button type="button" onClick={() => context.resources.edit(candidate.author!.resourceKind, candidate.author!.resourceId)}>[EDIT]</button>
              : null}
          </div>
          <label>ADDITIONAL NAMES
            <textarea rows={2} value={(draft.aliases[candidate.id] ?? []).join("\n")} placeholder="one additional player name per line" onChange={(event) => setDraft({ ...draft, aliases: { ...draft.aliases, [candidate.id]: patternLines(event.target.value) } })} />
          </label>
        </div>)}
      </div>
    </div>
    <div className="author-actions author-panel-footer">
      {provider.authorResourceKind && context.resources.canCreate(provider.authorResourceKind)
        ? <button type="button" onClick={() => context.resources.create(provider.authorResourceKind!, () => undefined)}>[+ CREATE {provider.label.toUpperCase()}]</button>
        : null}
      <button type="button" disabled={!dirty || saving} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
    </div>
  </section>;
}

function CommandGrammarWorkspace({ context }: { context: AuthorWorkspaceContext }) {
  const commands = context.snapshot.settings.commands.commands;
  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>PLAYER COMMANDS</span><span>{commands.length} {commands.length === 1 ? "COMMAND" : "COMMANDS"}</span></header>
    <div className="author-panel-body command-settings-list">
      {commands.map((command) => <button type="button" key={command.id} onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "command", data: { commandId: command.id } })}>
        <span><strong>{command.label}</strong><small>{command.patterns.join(" · ") || "no player inputs"}</small><small>ACTION · {actionLabel(command.action)}</small></span><span>{command.enabled ? "ON" : "OFF"} ›</span>
      </button>)}
      {!commands.length ? <div className="command-settings-empty">NO PLAYER COMMANDS.</div> : null}
    </div>
    <div className="author-actions author-panel-footer"><button type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "command", data: { commandId: "new" } })}>[+ PLAYER COMMAND]</button></div>
  </section>;
}

function CommandEditor({ context, commandId, initialOperation = "", resourceTask }: { context: AuthorWorkspaceContext; commandId: string; initialOperation?: string; resourceTask?: string }) {
  const existing = context.snapshot.settings.commands.commands.find((command) => command.id === commandId);
  const initial: CommandDefinition = structuredClone(existing ?? {
    id: crypto.randomUUID(),
    label: "",
    enabled: true,
    patterns: [],
    slots: [],
    action: initialOperation ? { type: "target-operation", operation: initialOperation, targetSlot: "" } : defaultResponseAction(),
  });
  const [draft, setDraft] = useState(initial);
  const [patternsText, setPatternsText] = useState(initial.patterns.join("\n"));
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const patterns = patternLines(patternsText);
  const slotNames = placeholderNames(patterns);
  const slots: CommandSlotDefinition[] = slotNames.map((name) => draft.slots.find((slot) => slot.name === name) ?? { name, sourceKinds: [] });
  const dirty = JSON.stringify({ ...draft, patterns, slots }) !== baseline;
  const providers = targetProviders();
  const targetAction = draft.action.type === "target-operation" ? draft.action : null;
  const targetActionKinds = targetAction
    ? slots.find((slot) => slot.name === targetAction.targetSlot)?.sourceKinds ?? []
    : [];
  const targetOperation = targetAction?.operation ?? "";
  const targetSlot = targetAction ? slots.find((slot) => slot.name === targetAction.targetSlot) : undefined;
  const targetPatternsWithoutSlot = targetAction?.targetSlot
    ? patterns.filter((pattern) => !patternHasSlot(pattern, targetAction.targetSlot))
    : [];
  const commandProblem = !draft.label.trim()
    ? "Give this command a name."
    : !patterns.length
      ? "Add at least one real player input. Placeholder text is not part of the command."
      : targetAction && !OPERATION_ID_PATTERN.test(targetAction.operation)
        ? "Target operations need a valid operation id."
        : targetAction && !targetAction.targetSlot
          ? "Choose which player-supplied value is the target."
          : targetAction && !targetSlot?.sourceKinds.length
            ? `Choose what {${targetAction.targetSlot}} can name.`
            : targetAction && targetPatternsWithoutSlot.length
              ? `Every input for this target operation must include {${targetAction.targetSlot}}. Put targetless wording in a separate Player Command.`
              : "";
  const showProblem = Boolean(commandProblem && (dirty || draft.label.trim() || patternsText.trim()));

  useEffect(() => {
    context.setWorkspaceDirty(dirty);
    return () => context.setWorkspaceDirty(false);
  }, [context.setWorkspaceDirty, dirty]);

  const setSlotKinds = (name: string, sourceKinds: string[]) => setDraft((current) => {
    const nextSlots = slotNames.map((slotName) => slotName === name
      ? { name, sourceKinds }
      : current.slots.find((slot) => slot.name === slotName) ?? { name: slotName, sourceKinds: [] });
    const action = current.action.type === "target-operation" && sourceKinds.length && !current.action.targetSlot
      ? { ...current.action, targetSlot: name }
      : current.action;
    return { ...current, slots: nextSlots, action };
  });

  const configureTarget = (sourceKind: string) => {
    const slotName = targetAction?.targetSlot || slots[0]?.name || "target";
    if (!slotNames.includes(slotName)) {
      const verb = normalizePlayerInput(draft.label || targetOperation || "inspect") || "inspect";
      const nextPatterns = patternLines(patternsText);
      setPatternsText([...nextPatterns, `${verb} {${slotName}}`].join("\n"));
    }
    setDraft((current) => {
      const names = slotNames.includes(slotName) ? slotNames : [...slotNames, slotName];
      const nextSlots = names.map((name) => {
        const existingSlot = current.slots.find((slot) => slot.name === name) ?? { name, sourceKinds: [] };
        if (name !== slotName) return existingSlot;
        return {
          ...existingSlot,
          sourceKinds: existingSlot.sourceKinds.includes(sourceKind)
            ? existingSlot.sourceKinds
            : [...existingSlot.sourceKinds, sourceKind],
        };
      });
      return {
        ...current,
        slots: nextSlots,
        action: current.action.type === "target-operation"
          ? { ...current.action, targetSlot: slotName }
          : current.action,
      };
    });
  };

  const chooseAction = (value: string) => {
    if (value === RESPONSE_ACTION) {
      setDraft((current) => ({ ...current, action: current.action.type === "response" ? current.action : defaultResponseAction() }));
      return;
    }
    if (value === TARGET_ACTION) {
      setDraft((current) => ({
        ...current,
        action: current.action.type === "target-operation"
          ? current.action
          : { type: "target-operation", operation: "inspect", targetSlot: slots.find((slot) => slot.sourceKinds.length)?.name ?? slots[0]?.name ?? "" },
      }));
      return;
    }
    setDraft((current) => ({ ...current, action: { type: "application", operation: value.replace(/^application:/, "") } }));
  };

  const save = async (): Promise<boolean> => {
    if (commandProblem) return false;
    const normalizedSlots = slotNames.map((name) => draft.slots.find((slot) => slot.name === name) ?? { name, sourceKinds: [] });
    const action = draft.action;
    if (action.type === "target-operation" && (
      !OPERATION_ID_PATTERN.test(action.operation)
      || !normalizedSlots.some((slot) => slot.name === action.targetSlot && slot.sourceKinds.length)
    )) return false;
    const command: CommandDefinition = { ...draft, label: draft.label.trim(), patterns, slots: normalizedSlots };
    let commands: CommandProjectSettings = {
      ...context.snapshot.settings.commands,
      commands: context.snapshot.settings.commands.commands.some((candidate) => candidate.id === command.id)
        ? context.snapshot.settings.commands.commands.map((candidate) => candidate.id === command.id ? command : candidate)
        : [...context.snapshot.settings.commands.commands, command],
    };
    for (const kind of new Set(normalizedSlots.flatMap((slot) => slot.sourceKinds))) {
      const setting = referenceSetting(commands, kind);
      commands = updateReferenceSetting(commands, { ...setting, enabled: true });
    }
    setSaving(true);
    try {
      const result = await persistCommands(context, commands, `${existing ? "Changed" : "Created"} command ${command.label}`);
      if (result.status !== "saved" && result.status !== "queued") return false;
      setDraft(command);
      setPatternsText(command.patterns.join("\n"));
      setBaseline(JSON.stringify(command));
      context.setWorkspaceDirty(false);
      if (resourceTask === "player-command") context.completeTask({ type: "resource", kind: "player-command", id: command.id, value: command.id, label: command.label });
      return true;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    context.registerWorkspaceSave(save);
    return () => context.registerWorkspaceSave(null);
  });

  const remove = async () => {
    if (!existing) return;
    const commands = {
      ...context.snapshot.settings.commands,
      commands: context.snapshot.settings.commands.commands.filter((command) => command.id !== existing.id),
    };
    const result = await persistCommands(context, commands, `Deleted command ${existing.label}`);
    if (result.status === "saved" || result.status === "queued") context.leaveCurrentTask();
  };

  return <section className="author-panel author-panel-frame command-settings-workspace">
    <header><span>PLAYER COMMAND · {draft.label || "NEW"}</span></header>
    <div className="author-panel-body command-editor-form">
      <label className="check-label"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> enabled</label>
      <label>NAME<input value={draft.label} placeholder="Command name" onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
      <label>PLAYER INPUTS<textarea rows={4} value={patternsText} placeholder="TYPE ONE PLAYER INPUT PER LINE" onChange={(event) => setPatternsText(event.target.value)} /></label>
      <small>These are literal player inputs, not examples. Use a value in braces when part of the input varies, for example <code>inspect {"{target}"}</code>.</small>

      {slots.length ? <section className="command-slot-editor">
        <h3>PLAYER-SUPPLIED VALUES</h3>
        {slots.map((slot) => <div className="command-slot-row" key={slot.name}>
          <strong>{`{${slot.name}}`}</strong>
          <small>What can this value name?</small>
          <label className="check-label"><input type="checkbox" checked={!slot.sourceKinds.length} onChange={() => setSlotKinds(slot.name, [])} /> FREE TEXT</label>
          {providers.map((provider) => <div key={provider.kind} className="command-slot-source-row">
            <label className="check-label"><input type="checkbox" checked={slot.sourceKinds.includes(provider.kind)} onChange={(event) => setSlotKinds(slot.name, event.target.checked ? [...slot.sourceKinds, provider.kind] : slot.sourceKinds.filter((kind) => kind !== provider.kind))} /> {provider.label.toUpperCase()}</label>
            {provider.authorResourceKind && context.resources.canOpenList(provider.authorResourceKind)
              ? <button type="button" onClick={() => context.resources.openList(provider.authorResourceKind!)}>[OPEN]</button>
              : null}
          </div>)}
        </div>)}
      </section> : null}

      <label>ACTION<select value={actionChoice(draft.action)} onChange={(event) => chooseAction(event.target.value)}>
        <option value={RESPONSE_ACTION}>RESPOND WITH TEXT</option>
        <option value={TARGET_ACTION}>TARGET OPERATION</option>
        {APPLICATION_COMMAND_CAPABILITIES.map((capability) => <option value={`application:${capability.operation}`} key={capability.operation}>{capability.label.toUpperCase()}</option>)}
      </select></label>

      {draft.action.type === "response" ? <section className="command-response-editor">
        <label>SPEAKER <ReferenceField kind="character" value={draft.action.speakerId ?? ""} onChange={(speakerId) => setDraft((current) => current.action.type === "response" ? { ...current, action: { ...current.action, speakerId: speakerId || null } } : current)} placeholder="none / narration" /></label>
        <AuthoredTextEditor
          value={{ text: draft.action.responseText, performance: draft.action.responsePerformance }}
          snapshot={context.snapshot}
          playState={context.playState}
          label="RESPONSE TEXT"
          rows={5}
          onChange={(value) => setDraft((current) => current.action.type === "response" ? { ...current, action: { ...current.action, responseText: value.text, responsePerformance: value.performance } } : current)}
          onPreview={(value) => context.runtime.preview({ text: value.text, performance: value.performance, speakerId: draft.action.type === "response" ? draft.action.speakerId : null })}
        />
        <OutcomeEffectsEditor effects={draft.action.effects} snapshot={context.snapshot} onChange={(effects) => setDraft((current) => current.action.type === "response" ? { ...current, action: { ...current.action, effects } } : current)} />
      </section> : null}

      {draft.action.type === "target-operation" ? <section className="command-target-action">
        <label>OPERATION<input value={draft.action.operation} placeholder="inspect" onChange={(event) => setDraft((current) => current.action.type === "target-operation" ? { ...current, action: { ...current.action, operation: event.target.value } } : current)} /></label>
        <small>The operation each resolved target will attempt.</small>
        {!targetActionKinds.length ? <div className="command-target-setup">
          <strong>CHOOSE A TARGET TYPE</strong>
          <small>This connects a real player-supplied value to an authored target. If you have not typed a value yet, the editor will add <code>{`${normalizePlayerInput(draft.label || draft.action.operation || "inspect") || "inspect"} {target}`}</code> for you.</small>
          <div>
            {providers.map((provider) => <button type="button" key={provider.kind} onClick={() => configureTarget(provider.kind)}>[TARGET {provider.label.toUpperCase()}]</button>)}
          </div>
        </div> : null}
        <label>TARGET INPUT<select value={draft.action.targetSlot} onChange={(event) => setDraft((current) => current.action.type === "target-operation" ? { ...current, action: { ...current.action, targetSlot: event.target.value } } : current)}>
          <option value="">CHOOSE…</option>
          {slots.map((slot) => <option key={slot.name} value={slot.name}>{`{${slot.name}}${slot.sourceKinds.length ? ` · ${slot.sourceKinds.map((kind) => semanticReferenceProvider(kind)?.label ?? kind).join(" + ")}` : " · choose target type"}`}</option>)}
        </select></label>
        {targetActionKinds.map((kind) => <button key={kind} type="button" onClick={() => context.pushTask({ type: "feature", feature: "commands", workspace: "target-behaviors", data: { sourceKind: kind, operation: targetOperation, commandLabel: draft.label } })}>[DEFINE {semanticReferenceProvider(kind)?.label.toUpperCase() ?? kind} BEHAVIOR]</button>)}
      </section> : null}

      {showProblem ? <div className="command-author-warning" role="status">{commandProblem}</div> : null}
    </div>
    <div className="author-actions author-panel-footer">
      <button type="button" disabled={!dirty || saving || Boolean(commandProblem)} onClick={() => void save()}>[{saving ? "SAVING..." : "SAVE"}]</button>
      {existing ? confirmDelete
        ? <><button type="button" onClick={() => void remove()}>[CONFIRM DELETE]</button><button type="button" onClick={() => setConfirmDelete(false)}>[KEEP]</button></>
        : <button type="button" onClick={() => setConfirmDelete(true)}>[DELETE]</button>
        : null}
    </div>
  </section>;
}

function TargetBehaviorsWorkspace({ context, sourceKind, operation, commandLabel }: { context: AuthorWorkspaceContext; sourceKind: string; operation: string; commandLabel: string }) {
  const adapter = context.resolveCommandTarget(sourceKind);
  const targets = adapter?.list(context.snapshot, operation) ?? [];
  return <section className="author-panel author-panel-frame command-settings-workspace target-behaviors-workspace">
    <header><span>{commandLabel || operation.toUpperCase()} · TARGET BEHAVIOR</span></header>
    <div className="author-panel-body command-settings-list">
      {targets.map((target) => <button type="button" key={target.id} onClick={() => adapter && context.pushTask(adapter.editRoute(target.id, operation))}>
        <span><strong>{target.label}</strong><small>{target.available ? "available" : "not available"} · {target.responseCount} response{target.responseCount === 1 ? "" : "s"}</small></span><span>›</span>
      </button>)}
      {!adapter ? <div className="command-settings-empty">NO AUTHORING ROUTE FOR THIS TARGET TYPE.</div> : null}
      {adapter && !targets.length ? <div className="command-settings-empty">NO {adapter.label.toUpperCase()}S EXIST YET.</div> : null}
    </div>
    {adapter?.createRoute ? <div className="author-actions author-panel-footer"><button type="button" onClick={() => context.pushTask(adapter.createRoute!(operation))}>[+ CREATE {adapter.label.toUpperCase()}]</button></div> : null}
  </section>;
}

export const COMMAND_PROJECT_SETTINGS_SECTION: readonly AuthorProjectSettingsSection[] = [{
  id: "commands",
  label: "PLAYER LANGUAGE",
  description: "Player commands and target names.",
  order: 20,
  render: (context) => <CommandsOverview context={context} />,
}];

export function renderCommandSettingsWorkspace(route: AuthorTaskRoute, context: AuthorWorkspaceContext) {
  if (route.type !== "feature" || route.feature !== "commands") return null;
  if (route.workspace === "references") return <ReferenceSourcesWorkspace context={context} />;
  if (route.workspace === "reference-source") return <ReferenceSourceEditor context={context} sourceKind={route.data?.sourceKind ?? ""} />;
  if (route.workspace === "grammar" || route.workspace === "capabilities") return <CommandGrammarWorkspace context={context} />;
  if (route.workspace === "command") return <CommandEditor context={context} commandId={route.data?.commandId ?? "new"} initialOperation={route.data?.operation ?? ""} resourceTask={route.data?.resourceTask} />;
  if (route.workspace === "interactions") return <PlayerInteractionsWorkspace context={context} />;
  if (route.workspace === "target-behaviors") return <TargetBehaviorsWorkspace context={context} sourceKind={route.data?.sourceKind ?? ""} operation={route.data?.operation ?? ""} commandLabel={route.data?.commandLabel ?? ""} />;
  return null;
}
