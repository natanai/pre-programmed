import "./textRulesReference.css";

export type InlineTextRule = "l" | "f" | "s" | "h" | "w" | "b" | "i" | "shake" | "speed" | "pause" | "literal-slash";

export type InlineFeatureCommandAction = {
  code: string;
  label: string;
  category: string;
  description: string;
};

/** Compact reference and insertion surface for the canonical inline command language. */
export function TextRulesReference({
  onApply,
  featureCommands = [],
  onApplyFeatureCommand,
}: {
  onApply?: (rule: InlineTextRule) => void;
  featureCommands?: readonly InlineFeatureCommandAction[];
  onApplyFeatureCommand?: (code: string) => void;
}) {
  const categories = [...new Set(featureCommands.map((command) => command.category))];

  return <details className="text-rules-reference">
    <summary>[? INLINE COMMANDS]</summary>
    <div className="text-rules-reference-body">
      <p>Commands live inside the writing and travel with it. Type them directly or use these controls to insert them at the current selection or cursor.</p>
      {onApply ? <div className="text-rule-group">
        <strong>DELIVERY</strong>
        <div className="text-rule-actions" aria-label="Insert delivery command">
          <button type="button" onClick={() => onApply("l")}>[SLOW]</button>
          <button type="button" onClick={() => onApply("f")}>[FAST]</button>
          <button type="button" onClick={() => onApply("s")}>[SHOUT]</button>
          <button type="button" onClick={() => onApply("h")}>[HIT]</button>
          <button type="button" onClick={() => onApply("w")}>[WAVE]</button>
          <button type="button" onClick={() => onApply("shake")}>[SHAKE]</button>
          <button type="button" onClick={() => onApply("speed")}>[SPEED]</button>
          <button type="button" onClick={() => onApply("b")}>[BLINK]</button>
          <button type="button" onClick={() => onApply("i")}>[INSTANT]</button>
          <button type="button" onClick={() => onApply("pause")}>[PAUSE]</button>
        </div>
      </div> : null}
      {onApplyFeatureCommand ? categories.map((category) => <div className="text-rule-group" key={category}>
        <strong>{category.toUpperCase()}</strong>
        <div className="text-rule-actions" aria-label={`Insert ${category.toLowerCase()} command`}>
          {featureCommands.filter((command) => command.category === category).map((command) => <button
            type="button"
            key={command.code}
            title={command.description}
            onClick={() => onApplyFeatureCommand(command.code)}
          >[{command.label.toUpperCase()}]</button>)}
        </div>
      </div>) : null}
      <div className="text-rules-grid">
        <span><strong>/l&#123;text&#125;</strong> slow</span>
        <span><strong>/f&#123;text&#125;</strong> fast</span>
        <span><strong>/s&#123;text&#125;</strong> shout</span>
        <span><strong>/h&#123;text&#125;</strong> hit</span>
        <span><strong>/w&#123;text&#125;</strong> wave</span>
        <span><strong>/shake&#123;text&#125;</strong> shake</span>
        <span><strong>/speed30&#123;text&#125;</strong> 30 chars/sec</span>
        <span><strong>/b&#123;text&#125;</strong> blink</span>
        <span><strong>/i&#123;text&#125;</strong> instant</span>
        <span><strong>/p</strong> short pause</span>
        <span><strong>/p750</strong> 750 ms pause</span>
        <span><strong>//</strong> literal slash</span>
        {featureCommands.map((command) => <span key={`syntax:${command.code}`} title={command.description}>
          <strong>/{command.code}&#123;resource&#125;</strong> {command.label.toLowerCase()}
        </span>)}
      </div>
      <p className="text-rules-example"><strong>Example:</strong> I am /h&#123;NOT&#125; going./p750 Okay?</p>
    </div>
  </details>;
}
