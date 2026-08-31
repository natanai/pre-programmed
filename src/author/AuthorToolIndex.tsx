import "./authorNavigation.css";

export type AuthorTool = {
  id: string;
  label: string;
  description: string;
  onSelect: () => void;
  tone?: "normal" | "draft";
};

export type AuthorToolGroup = {
  id: string;
  label: string;
  tools: AuthorTool[];
};

export function AuthorToolIndex({ groups }: { groups: AuthorToolGroup[] }) {
  return <section className="author-panel author-panel-frame author-tool-index" aria-label="Author tools">
    <header><span>AUTHOR TOOLS</span></header>
    <div className="author-panel-body author-tool-index-body">
      {groups.map((group) => <section className="author-tool-group" key={group.id}>
        <h3>{group.label}</h3>
        <div className="author-tool-list">
          {group.tools.map((tool) => <button
            type="button"
            className={tool.tone === "draft" ? "draft-input" : ""}
            key={tool.id}
            onClick={tool.onSelect}
          >
            <span className="author-tool-copy">
              <strong>{tool.label}</strong>
              <small>{tool.description}</small>
            </span>
            <span className="author-tool-arrow" aria-hidden="true">›</span>
          </button>)}
        </div>
      </section>)}
    </div>
    <footer className="author-panel-footer"><span>SELECT A TOOL OR [X] TO RETURN TO PLAY.</span></footer>
  </section>;
}
