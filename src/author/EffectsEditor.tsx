import { useState } from "react";
import type { Effect } from "../engine/rules/model";
import type { ProjectSnapshot } from "../engine/project/model";
import { effectAuthorAdapter, effectAuthorAdapters } from "./rules/catalog";
import type { EffectAuthorAdapter } from "./rules/types";
import "./effectsEditor.css";

type EffectsScreen = "list" | "choose" | "edit";

export function EffectsEditor({ effects, onChange, snapshot, targetKind }: {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
  snapshot: ProjectSnapshot;
  /** Optional semantic operation target; target-bound effects stay out of unrelated authoring surfaces. */
  targetKind?: string;
}) {
  const [screen, setScreen] = useState<EffectsScreen>("list");
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const adapters = effectAuthorAdapters().filter((adapter) =>
    !adapter.targetKinds?.length || Boolean(targetKind && adapter.targetKinds.includes(targetKind)),
  );
  const categories = [...new Set(adapters.map((adapter) => adapter.category))];
  const selectedIndex = selectedEffectId ? effects.findIndex((effect) => effect.id === selectedEffectId) : -1;
  const selectedEffect = selectedIndex >= 0 ? effects[selectedIndex] : undefined;

  const replace = (index: number, effect: Effect) => onChange(effects.map((item, itemIndex) => itemIndex === index ? effect : item));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= effects.length) return;
    const next = [...effects];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const openEffect = (effect: Effect) => {
    setSelectedEffectId(effect.id);
    setScreen("edit");
  };

  const addEffect = (adapter: EffectAuthorAdapter) => {
    const effect = adapter.create();
    onChange([...effects, effect]);
    setSelectedEffectId(effect.id);
    setScreen("edit");
  };

  const removeSelected = () => {
    if (selectedIndex < 0) return;
    onChange(effects.filter((_, index) => index !== selectedIndex));
    setSelectedEffectId(null);
    setScreen("list");
  };

  const changeSelectedType = (type: Effect["type"]) => {
    if (!selectedEffect || selectedIndex < 0) return;
    const adapter = effectAuthorAdapter(type);
    if (!adapter) return;
    const replacement = { ...adapter.create(), id: selectedEffect.id } as Effect;
    replace(selectedIndex, replacement);
  };

  if (screen === "choose") return <div className="effects-editor effects-chooser">
    <button type="button" className="effects-back" onClick={() => setScreen("list")}>[← BACK TO EFFECTS]</button>
    <h3>WHAT ELSE HAPPENS?</h3>
    <div className="effect-type-groups">{categories.map((category) => <section key={category}>
      <h4>{category.toUpperCase()}</h4>
      <div className="effect-type-list">
        {adapters.filter((adapter) => adapter.category === category).map((adapter) => <button type="button" key={adapter.type} onClick={() => addEffect(adapter)}>
          <span><strong>{adapter.label.toUpperCase()}</strong><small>{adapter.description}</small></span><span aria-hidden="true">›</span>
        </button>)}
      </div>
    </section>)}</div>
  </div>;

  if (screen === "edit" && selectedEffect && selectedIndex >= 0) {
    const adapter = effectAuthorAdapter(selectedEffect.type);
    return <div className="effects-editor focused-effect-editor">
      <button type="button" className="effects-back" onClick={() => { setSelectedEffectId(null); setScreen("list"); }}>[← BACK TO EFFECTS]</button>
      <div className="focused-effect-heading">
        <span>EFFECT {selectedIndex + 1}</span>
        <small>{adapter?.summarize?.(selectedEffect, snapshot) ?? adapter?.label ?? selectedEffect.type}</small>
      </div>
      <label>TYPE <select value={selectedEffect.type} onChange={(event) => changeSelectedType(event.target.value as Effect["type"])}>
        {adapters.map((option) => <option value={option.type} key={option.type}>{option.label}</option>)}
      </select></label>
      <div className="focused-effect-fields">
        {adapter?.render({ effect: selectedEffect, onChange: (next) => replace(selectedIndex, next), snapshot })}
      </div>
      <button type="button" className="effect-remove" onClick={removeSelected}>[REMOVE EFFECT]</button>
    </div>;
  }

  return <div className="effects-editor effects-overview">
    {effects.length ? <div className="effect-summary-list">
      {effects.map((effect, index) => {
        const adapter = effectAuthorAdapter(effect.type);
        const summary = adapter?.summarize?.(effect, snapshot) ?? adapter?.label ?? effect.type;
        return <div className="effect-summary-row" key={effect.id}>
          <button type="button" className="effect-summary-open" onClick={() => openEffect(effect)}>
            <span className="effect-summary-number">{index + 1}</span>
            <span className="effect-summary-copy"><strong>{adapter?.label.toUpperCase() ?? effect.type.toUpperCase()}</strong><small>{summary}</small></span>
            <span aria-hidden="true">›</span>
          </button>
          <div className="effect-summary-order">
            <button type="button" onClick={() => move(index, -1)} aria-label={`Move effect ${index + 1} up`}>[↑]</button>
            <button type="button" onClick={() => move(index, 1)} aria-label={`Move effect ${index + 1} down`}>[↓]</button>
          </div>
        </div>;
      })}
    </div> : <div className="effects-empty">No effects configured.</div>}
    <button type="button" className="effect-add" onClick={() => setScreen("choose")}>[+ EFFECT]</button>
  </div>;
}
