import type { Effect, ProjectSnapshot } from "../game/model";
import { EFFECT_AUTHOR_ADAPTERS, EFFECT_AUTHOR_ADAPTER_BY_TYPE } from "./rules/catalog";

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
  const defaultAdapter = EFFECT_AUTHOR_ADAPTER_BY_TYPE.increment ?? EFFECT_AUTHOR_ADAPTERS[0];

  return <div className="effects-editor">
    {effects.map((effect, index) => {
      const adapter = EFFECT_AUTHOR_ADAPTER_BY_TYPE[effect.type];
      return <div className="effect-row" key={effect.id}>
        <span className="effect-order">{index + 1}</span>
        <select value={effect.type} onChange={(event) => {
          const next = EFFECT_AUTHOR_ADAPTER_BY_TYPE[event.target.value as Effect["type"]];
          if (next) replace(index, next.create());
        }}>
          {EFFECT_AUTHOR_ADAPTERS.map((option) => <option value={option.type} key={option.type}>{option.label}</option>)}
        </select>
        {adapter?.render({ effect, onChange: (next) => replace(index, next), snapshot })}
        <div className="row-actions">
          <button type="button" onClick={() => move(index, -1)} aria-label="Move effect up">[↑]</button>
          <button type="button" onClick={() => move(index, 1)} aria-label="Move effect down">[↓]</button>
          <button type="button" onClick={() => onChange(effects.filter((_, itemIndex) => itemIndex !== index))}>[REMOVE]</button>
        </div>
      </div>;
    })}
    <button type="button" onClick={() => defaultAdapter && onChange([...effects, defaultAdapter.create()])}>[+ EFFECT]</button>
  </div>;
}
