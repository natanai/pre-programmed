import type { ReactNode } from "react";
import type { ProjectSnapshot } from "../../engine/project/model";
import type { Condition, Effect } from "../../engine/rules/model";
import { ConditionEditor } from "../ConditionEditor";
import { EffectsEditor } from "../EffectsEditor";
import { AuthorInlineDisclosure } from "../ui/AuthorInlineDisclosure";
import "./outcomeComposer.css";

export function OutcomeComposerSection({ title, summary, children, defaultOpen = false }: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return <AuthorInlineDisclosure
    label={title}
    summary={summary}
    defaultOpen={defaultOpen}
    className="outcome-composer-section"
  >
    <div className="outcome-composer-section-body">{children}</div>
  </AuthorInlineDisclosure>;
}

export function OutcomeConditionEditor({ condition, snapshot, onChange, language = "time" }: {
  condition: Condition;
  snapshot: ProjectSnapshot;
  onChange: (condition: Condition) => void;
  language?: "time" | "attempt";
}) {
  return <div className="outcome-condition-editor">
    <div className="attempt-presets outcome-condition-presets" aria-label={`${language === "time" ? "Timing" : "Attempt"} presets`}>
      <button type="button" onClick={() => onChange({ type: "always" })}>[ALWAYS]</button>
      <button type="button" onClick={() => onChange({ type: "attempt", operator: "eq", value: 1 })}>[FIRST]</button>
      <button type="button" onClick={() => onChange({ type: "attempt", operator: "eq", value: 2 })}>[SECOND]</button>
      <button type="button" onClick={() => onChange({ type: "attempt", operator: "gte", value: 2 })}>[SECOND+]</button>
    </div>
    <ConditionEditor condition={condition} snapshot={snapshot} onChange={onChange} />
  </div>;
}

export function OutcomeEffectsEditor({ effects, snapshot, onChange, targetKind }: {
  effects: Effect[];
  snapshot: ProjectSnapshot;
  onChange: (effects: Effect[]) => void;
  targetKind?: string;
}) {
  return <div className="outcome-effects-editor">
    <p>Optional world and presentation changes. They run from top to bottom after this response is selected.</p>
    <EffectsEditor effects={effects} snapshot={snapshot} targetKind={targetKind} onChange={onChange} />
  </div>;
}
