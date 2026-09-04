import "./authorNavigation.css";
import "./liveAuthoring.css";

export function AuthorHome({
  nodeNumber,
  revision,
  notation,
  message,
  onEditNode,
  onOpenTools,
}: {
  nodeNumber: number;
  revision: number;
  notation: string;
  /** Retained in the shell contract while command diagnostics stay Tools-owned. */
  match?: string;
  /** Invalid-input authoring is Node-owned and no longer rendered on the live footer. */
  invalidLabel: string;
  invalidDraft: boolean;
  message?: string;
  onEditNode: () => void;
  onEditInvalid: () => void;
  onEditMatch?: () => void;
  onEditPrompt?: () => void;
  onOpenTools: () => void;
}) {
  return <section className="author-home" aria-label="Author controls for current node">
    <div className="author-home-status">
      <span>[AUTHOR] #{nodeNumber} R{revision} {notation}</span>
    </div>
    <nav className="author-home-actions" aria-label="Current node author actions">
      <button type="button" onClick={onEditNode}>[EDIT NODE]</button>
      <button type="button" onClick={onOpenTools}>[TOOLS]</button>
    </nav>
    {message ? <div className="author-home-message" role="status">{message}</div> : null}
  </section>;
}
