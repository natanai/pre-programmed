import "./textRulesReference.css";

/**
 * Compact reminder for Narrative's canonical inline performance notation.
 *
 * This component does not transform or own authored text. The textarea remains
 * the authoring surface and compileTextNotation remains the single runtime
 * interpreter for these rules.
 */
export function TextRulesReference() {
  return <details className="text-rules-reference">
    <summary>[? TEXT RULES]</summary>
    <div className="text-rules-reference-body">
      <p>Write these directly in the text. They change how words are delivered; they do not run game/world effects.</p>
      <div className="text-rules-grid">
        <span><strong>/l&#123;text&#125;</strong> slow</span>
        <span><strong>/f&#123;text&#125;</strong> fast</span>
        <span><strong>/s&#123;text&#125;</strong> shout</span>
        <span><strong>/h&#123;text&#125;</strong> hit</span>
        <span><strong>/w&#123;text&#125;</strong> wave</span>
        <span><strong>/b&#123;text&#125;</strong> blink</span>
        <span><strong>/i&#123;text&#125;</strong> instant</span>
        <span><strong>/p</strong> short pause</span>
        <span><strong>/p750</strong> 750 ms pause</span>
        <span><strong>//</strong> literal slash</span>
      </div>
      <p className="text-rules-example"><strong>Example:</strong> I am /h&#123;NOT&#125; going./p750 Okay?</p>
    </div>
  </details>;
}
