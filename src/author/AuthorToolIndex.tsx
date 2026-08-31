import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        tools: group.tools.filter((tool) => [group.label, tool.label, tool.description]
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))),
      }))
      .filter((group) => group.tools.length > 0);
  }, [groups, normalizedQuery]);
  const visibleCount = visibleGroups.reduce((count, group) => count + group.tools.length, 0);

  return <section className="author-panel author-panel-frame author-tool-index" aria-label="Author tools">
    <header><span>AUTHOR TOOLS</span><small>{normalizedQuery ? `${visibleCount} FOUND` : `${groups.reduce((count, group) => count + group.tools.length, 0)} TOOLS`}</small></header>
    <div className="author-panel-body author-tool-index-body">
      <label className="author-tool-search">
        <span>FIND</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="tool, system, or task"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query ? <button type="button" aria-label="Clear tool search" onClick={() => setQuery("")}>[CLEAR]</button> : null}
      </label>
      {visibleGroups.map((group) => <section className="author-tool-group" key={group.id}>
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
      {!visibleCount ? <div className="author-tool-empty" role="status">NO AUTHOR TOOLS MATCH “{query.trim()}”.</div> : null}
    </div>
    <footer className="author-panel-footer"><span>{normalizedQuery ? "SEARCH LABELS, GROUPS, AND DESCRIPTIONS." : "SELECT A TOOL OR [X] TO RETURN TO PLAY."}</span></footer>
  </section>;
}
