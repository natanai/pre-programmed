import "./authorNavigation.css";

export function AuthorHome({
  nodeNumber,
  revision,
  notation,
  match,
  invalidLabel,
  invalidDraft,
  message,
  onEditNode,
  onEditInvalid,
  onOpenTools,
}: {
  nodeNumber: number;
  revision: number;
  notation: string;
  match?: string;
  invalidLabel: string;
  invalidDraft: boolean;
  message?: string;
  onEditNode: () => void;
  onEditInvalid: () => void;
  onOpenTools: () => void;
}) {
  return <section className="author-home" aria-label="Author controls for current node">
    <div className="author-home-status">
      <span>[AUTHOR] #{nodeNumber} R{revision} {notation}</span>
      {match ? <span className="author-home-match">MATCH: {match}</span> : null}
    </div>
    <nav className="author-home-actions" aria-label="Current node author actions">
      <button type="button" onClick={onEditNode}>[EDIT NODE]</button>
      <button type="button" className={invalidDraft ? "draft-input" : ""} onClick={onEditInvalid}>{invalidLabel}</button>
      <button type="button" onClick={onOpenTools}>[TOOLS]</button>
    </nav>
    {message ? <div className="author-home-message" role="status">{message}</div> : null}
  </section>;
}
