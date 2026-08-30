import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { makeValueToken } from "../game/interpolation";
import type { Condition, Effect, ProjectSnapshot, Value } from "../game/model";

const conditionTypes: Array<{ value: Condition["type"]; label: string }> = [
  { value: "always", label: "always" },
  { value: "all", label: "all (AND)" },
  { value: "any", label: "any (OR)" },
  { value: "not", label: "not" },
  { value: "has_item", label: "has item" },
  { value: "lacks_item", label: "lacks item" },
  { value: "flag", label: "flag" },
  { value: "variable", label: "variable comparison" },
  { value: "attempt", label: "attempt count" },
  { value: "visited", label: "visited node" },
  { value: "state", label: "state field" },
];

function newCondition(type: Condition["type"]): Condition {
  switch (type) {
    case "all":
    case "any":
      return { type, conditions: [{ type: "always" }] };
    case "not":
      return { type, condition: { type: "always" } };
    case "has_item":
      return { type, itemId: "", minimum: 1 };
    case "lacks_item":
      return { type, itemId: "" };
    case "flag":
      return { type, key: "", value: true };
    case "variable":
      return { type, key: "", operator: "eq", value: 0 };
    case "attempt":
      return { type, operator: "eq", value: 1 };
    case "visited":
      return { type, nodeId: "", value: true };
    case "state":
      return { type, field: "currentNodeId", operator: "eq", value: "" };
    default:
      return { type: "always" };
  }
}

function parseValue(value: string, sample: Value): Value {
  if (typeof sample === "number") return Number(value);
  if (typeof sample === "boolean") return value === "true";
  return value;
}

export function ConditionEditor({
  condition,
  onChange,
  snapshot,
  depth = 0,
}: {
  condition: Condition;
  onChange: (condition: Condition) => void;
  snapshot: ProjectSnapshot;
  depth?: number;
}) {
  const selectType = (event: ChangeEvent<HTMLSelectElement>) =>
    onChange(newCondition(event.target.value as Condition["type"]));
  return (
    <div className={`condition-editor condition-depth-${Math.min(depth, 3)}`}>
      <select aria-label="Condition type" value={condition.type} onChange={selectType}>
        {conditionTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>

      {(condition.type === "all" || condition.type === "any") ? (
        <div className="condition-children">
          {condition.conditions.map((child, index) => (
            <div className="condition-child" key={index}>
              <ConditionEditor
                condition={child}
                snapshot={snapshot}
                depth={depth + 1}
                onChange={(next) => onChange({
                  ...condition,
                  conditions: condition.conditions.map((value, childIndex) => childIndex === index ? next : value),
                })}
              />
              <button type="button" onClick={() => onChange({
                ...condition,
                conditions: condition.conditions.filter((_, childIndex) => childIndex !== index),
              })}>[-]</button>
            </div>
          ))}
          <button type="button" onClick={() => onChange({
            ...condition,
            conditions: [...condition.conditions, { type: "always" }],
          })}>[+ CONDITION]</button>
        </div>
      ) : null}

      {condition.type === "not" ? (
        <ConditionEditor condition={condition.condition} snapshot={snapshot} depth={depth + 1}
          onChange={(next) => onChange({ ...condition, condition: next })} />
      ) : null}

      {condition.type === "has_item" || condition.type === "lacks_item" ? (
        <>
          <select value={condition.itemId} onChange={(event) => onChange({ ...condition, itemId: event.target.value })}>
            <option value="">choose item</option>
            {snapshot.items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          {condition.type === "has_item" ? (
            <input aria-label="Minimum quantity" type="number" min={1} value={condition.minimum ?? 1}
              onChange={(event) => onChange({ ...condition, minimum: Number(event.target.value) })} />
          ) : null}
        </>
      ) : null}

      {condition.type === "flag" ? (
        <>
          <select value={condition.key} onChange={(event) => onChange({ ...condition, key: event.target.value })}>
            <option value="">choose flag</option>
            {snapshot.variables.filter((item) => item.valueType === "boolean").map((item) =>
              <option value={item.key} key={item.id}>{item.label}</option>)}
          </select>
          <select value={String(condition.value)} onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}>
            <option value="true">is true</option><option value="false">is false</option>
          </select>
        </>
      ) : null}

      {condition.type === "variable" ? (
        <>
          <select value={condition.key} onChange={(event) => {
            const definition = snapshot.variables.find((item) => item.key === event.target.value);
            onChange({ ...condition, key: event.target.value, value: definition?.initialValue ?? 0 });
          }}>
            <option value="">choose value</option>
            {snapshot.variables.map((item) => <option value={item.key} key={item.id}>{item.label}</option>)}
          </select>
          <ComparisonSelect value={condition.operator} onChange={(operator) => onChange({ ...condition, operator })} />
          <input aria-label="Comparison value" value={String(condition.value ?? "")}
            onChange={(event) => onChange({ ...condition, value: parseValue(event.target.value, condition.value) })} />
        </>
      ) : null}

      {condition.type === "attempt" ? (
        <>
          <ComparisonSelect value={condition.operator} onChange={(operator) => onChange({ ...condition, operator })} />
          <input aria-label="Attempt number" type="number" min={0} value={condition.value}
            onChange={(event) => onChange({ ...condition, value: Number(event.target.value) })} />
          <small>Uses this interaction or operation automatically.</small>
        </>
      ) : null}

      {condition.type === "visited" ? (
        <>
          <select value={condition.nodeId} onChange={(event) => onChange({ ...condition, nodeId: event.target.value })}>
            <option value="">choose node</option>
            {snapshot.nodes.map((node) => <option value={node.id} key={node.id}>#{node.nodeNumber} {node.text.slice(0, 40)}</option>)}
          </select>
          <select value={String(condition.value)} onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}>
            <option value="true">visited</option><option value="false">unvisited</option>
          </select>
        </>
      ) : null}

      {condition.type === "state" ? (
        <>
          <select value={condition.field} onChange={(event) => onChange({ ...condition, field: event.target.value as "currentNodeId" | "lastCommand" })}>
            <option value="currentNodeId">current node</option><option value="lastCommand">last command</option>
          </select>
          <select value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value as "eq" | "neq" })}>
            <option value="eq">equals</option><option value="neq">does not equal</option>
          </select>
          <input value={condition.value} onChange={(event) => onChange({ ...condition, value: event.target.value })} />
        </>
      ) : null}
    </div>
  );
}

function ComparisonSelect({ value, onChange }: {
  value: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
  onChange: (value: "eq" | "neq" | "gt" | "gte" | "lt" | "lte") => void;
}) {
  return <select aria-label="Comparison" value={value} onChange={(event) => onChange(event.target.value as typeof value)}>
    <option value="eq">=</option><option value="neq">≠</option><option value="gt">&gt;</option>
    <option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option>
  </select>;
}

const effectTypes: Array<{ value: Effect["type"]; label: string }> = [
  { value: "set_flag", label: "set flag" }, { value: "clear_flag", label: "clear flag" },
  { value: "set_value", label: "set value" }, { value: "increment", label: "increment" },
  { value: "decrement", label: "decrement" }, { value: "give_item", label: "give item" },
  { value: "remove_item", label: "remove item" }, { value: "set_item_state", label: "change item state" },
  { value: "set_interaction_visibility", label: "show/hide interaction" },
  { value: "notification", label: "floating notification" }, { value: "synth", label: "play synth" },
  { value: "audio", label: "play repo audio" }, { value: "art", label: "show sprite/art" },
  { value: "transition", label: "transition" },
];

function newEffect(type: Effect["type"]): Effect {
  const id = crypto.randomUUID();
  switch (type) {
    case "set_flag": return { id, type, key: "" };
    case "clear_flag": return { id, type, key: "" };
    case "set_value": return { id, type, key: "", value: 0 };
    case "increment": return { id, type, key: "", amount: 1 };
    case "decrement": return { id, type, key: "", amount: 1 };
    case "give_item": return { id, type, itemId: "", quantity: 1 };
    case "remove_item": return { id, type, itemId: "", quantity: 1 };
    case "set_item_state": return { id, type, itemId: "", key: "", value: "" };
    case "set_interaction_visibility": return { id, type, interactionId: "", visible: true };
    case "notification": return { id, type, text: "" };
    case "synth": return { id, type, synthId: "" };
    case "audio": return { id, type, assetPath: "" };
    case "art": return { id, type, assetPath: "" };
    case "transition": return { id, type, nodeId: "" };
  }
}

export function EffectsEditor({ effects, onChange, snapshot }: {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
  snapshot: ProjectSnapshot;
}) {
  const replace = (index: number, effect: Effect) => onChange(effects.map((item, itemIndex) => itemIndex === index ? effect : item));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= effects.length) return;
    const next = [...effects];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return <div className="effects-editor">
    {effects.map((effect, index) => <div className="effect-row" key={effect.id}>
      <span className="effect-order">{index + 1}</span>
      <select value={effect.type} onChange={(event) => replace(index, newEffect(event.target.value as Effect["type"]))}>
        {effectTypes.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
      </select>
      <EffectFields effect={effect} onChange={(next) => replace(index, next)} snapshot={snapshot} />
      <div className="row-actions"><button type="button" onClick={() => move(index, -1)} aria-label="Move effect up">[↑]</button>
        <button type="button" onClick={() => move(index, 1)} aria-label="Move effect down">[↓]</button>
        <button type="button" onClick={() => onChange(effects.filter((_, itemIndex) => itemIndex !== index))}>[REMOVE]</button></div>
    </div>)}
    <button type="button" onClick={() => onChange([...effects, newEffect("increment")])}>[+ EFFECT]</button>
  </div>;
}

function EffectFields({ effect, onChange, snapshot }: { effect: Effect; onChange: (effect: Effect) => void; snapshot: ProjectSnapshot }) {
  if (effect.type === "set_flag" || effect.type === "clear_flag") return <DefinitionSelect value={effect.key} definitions={snapshot.variables.filter((item) => item.valueType === "boolean")} onChange={(key) => onChange({ ...effect, key })} />;
  if (effect.type === "set_value") {
    const definition = snapshot.variables.find((item) => item.key === effect.key);
    return <><DefinitionSelect value={effect.key} definitions={snapshot.variables} onChange={(key) => {
      const next = snapshot.variables.find((item) => item.key === key);
      onChange({ ...effect, key, value: next?.initialValue ?? "" });
    }} />{definition?.valueType === "boolean" ? <select value={String(effect.value)} onChange={(event) => onChange({ ...effect, value: event.target.value === "true" })}><option value="true">true</option><option value="false">false</option></select> : <input type={definition?.valueType === "number" ? "number" : "text"} value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: definition?.valueType === "number" ? Number(event.target.value) : event.target.value })} />}</>;
  }
  if (effect.type === "increment" || effect.type === "decrement") return <><DefinitionSelect value={effect.key} definitions={snapshot.variables.filter((item) => item.valueType === "number")} onChange={(key) => onChange({ ...effect, key })} /><input type="number" value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} /></>;
  if (effect.type === "give_item" || effect.type === "remove_item") return <><DefinitionSelect value={effect.itemId} definitions={snapshot.items} valueMode="id" onChange={(itemId) => onChange({ ...effect, itemId })} /><input type="number" min={1} value={effect.quantity} onChange={(event) => onChange({ ...effect, quantity: Number(event.target.value) })} /></>;
  if (effect.type === "set_item_state") return <><DefinitionSelect value={effect.itemId} definitions={snapshot.items} valueMode="id" onChange={(itemId) => onChange({ ...effect, itemId })} /><input placeholder="state key" value={effect.key} onChange={(event) => onChange({ ...effect, key: event.target.value })} /><input placeholder="value" value={String(effect.value ?? "")} onChange={(event) => onChange({ ...effect, value: event.target.value })} /></>;
  if (effect.type === "set_interaction_visibility") return <><DefinitionSelect value={effect.interactionId} definitions={snapshot.interactions} onChange={(interactionId) => onChange({ ...effect, interactionId })} /><select value={String(effect.visible)} onChange={(event) => onChange({ ...effect, visible: event.target.value === "true" })}><option value="true">show</option><option value="false">hide</option></select></>;
  if (effect.type === "notification") return <div className="effect-notification"><ValueMentionField snapshot={snapshot} value={effect.text} onValueChange={(text) => onChange({ ...effect, text })} placeholder="notification text" /></div>;
  if (effect.type === "synth") return <DefinitionSelect value={effect.synthId} definitions={snapshot.synthSounds} valueMode="id" onChange={(synthId) => onChange({ ...effect, synthId })} />;
  if (effect.type === "audio" || effect.type === "art") return <input placeholder="manifest asset path" value={effect.assetPath} onChange={(event) => onChange({ ...effect, assetPath: event.target.value })} />;
  if (effect.type === "transition") return <select value={effect.nodeId} onChange={(event) => onChange({ ...effect, nodeId: event.target.value })}><option value="">choose node</option>{snapshot.nodes.map((node) => <option value={node.id} key={node.id}>#{node.nodeNumber} {node.text.slice(0, 40)}</option>)}</select>;
  return null;
}

function DefinitionSelect({ value, definitions, valueMode = "key", onChange }: { value: string; definitions: Array<{ id: string; key?: string; label?: string; name?: string; wording?: string }>; valueMode?: "key" | "id"; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">choose</option>{definitions.map((item) => <option key={item.id} value={valueMode === "id" ? item.id : (item.key ?? item.id)}>{item.label ?? item.name ?? item.wording ?? item.key ?? item.id}</option>)}</select>;
}

type Mention = { start: number; end: number; query: string };

function mentionAt(value: string, cursor: number): Mention | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|[\s([{])@([a-z0-9_-]*)$/i);
  if (!match) return null;
  const query = match[1];
  return { start: cursor - query.length - 1, end: cursor, query };
}

export function ValueMentionField({
  snapshot,
  value,
  onValueChange,
  multiline = false,
  rows = 2,
  placeholder,
  ariaLabel,
  autoFocus,
  textareaRef,
  onKeyDown,
}: {
  snapshot: ProjectSnapshot;
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  const control = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [selection, setSelection] = useState(0);
  const candidates = useMemo(() => [
    ...snapshot.variables.map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      kind: "variable" as const,
      token: makeValueToken("variable", item.key),
    })),
    ...snapshot.computedValues.map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      kind: "computed" as const,
      token: makeValueToken("computed", item.key, item.format),
    })),
  ], [snapshot.variables, snapshot.computedValues]);
  const matches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return candidates
      .filter((item) => !query || `${item.key} ${item.label}`.toLowerCase().includes(query))
      .slice(0, 6);
  }, [candidates, mention]);

  const syncMention = (next: string, cursor: number | null) => {
    setMention(mentionAt(next, cursor ?? next.length));
    setSelection(0);
  };
  const selectMatch = (match: (typeof matches)[number]) => {
    if (!mention) return;
    const next = `${value.slice(0, mention.start)}${match.token}${value.slice(mention.end)}`;
    const cursor = mention.start + match.token.length;
    onValueChange(next);
    setMention(null);
    window.requestAnimationFrame(() => {
      control.current?.focus();
      control.current?.setSelectionRange(cursor, cursor);
    });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (mention && matches.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelection((current) => (current + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectMatch(matches[selection % matches.length]);
        return;
      }
    }
    if (mention && event.key === "Escape") {
      event.preventDefault();
      setMention(null);
      return;
    }
    onKeyDown?.(event);
  };
  const common = {
    value,
    placeholder,
    "aria-label": ariaLabel,
    autoFocus,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onValueChange(event.target.value);
      syncMention(event.target.value, event.target.selectionStart);
    },
    onClick: (event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => syncMention(value, event.currentTarget.selectionStart),
    onKeyUp: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) syncMention(event.currentTarget.value, event.currentTarget.selectionStart);
    },
    onKeyDown: handleKeyDown,
  };

  return <div className="value-mention-field">
    {multiline
      ? <textarea {...common} rows={rows} ref={(element) => { control.current = element; if (textareaRef) textareaRef.current = element; }} />
      : <input {...common} ref={(element) => { control.current = element; }} />}
    {mention ? <div className="value-mention-menu" role="listbox" aria-label="Matching values">
      {matches.length ? matches.map((match, index) => <button
        type="button"
        role="option"
        aria-selected={index === selection % matches.length}
        key={`${match.kind}:${match.id}`}
        onPointerDown={(event) => { event.preventDefault(); selectMatch(match); }}
      ><span>{match.label}</span><span>@{match.key}</span></button>) : <span>NO MATCH</span>}
    </div> : null}
  </div>;
}
