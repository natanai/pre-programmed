import { useMemo, useState } from "react";
import { searchAuthorEntries } from "./search/authorSearch";
import type { AuthorSearchEntry } from "./search/types";
import "./authorNavigation.css";

export type AuthorTool = {
  id: string;
  label: string;
  description: string;
  searchText?: string;
  onSelect: () => void;
  tone?: "normal" | "draft";
};

export type AuthorToolGroup = {
  id: string;
  label: string;
  tools: AuthorTool[];
};

export function AuthorToolIndex({ groups, searchEntries }: { groups: AuthorToolGroup[]; searchEntries: AuthorSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = useMemo(() => searchAuthorEntries(searchEntries, query), [query, searchEntries]);
  const visibleCount = normalizedQuery ? results.length : groups.reduce((count, group) => count + group.tools.length, 0);

  return <section className="author-panel author-panel-frame author-tool-index" aria-label="Author tools">
    <header><span>AUTHOR TOOLS</span><small>{normalizedQuery ? `${visibleCount} FOUND` : `${groups.reduce((count, group) => count + group.tools.length, 0)} TOOLS`}</small></header>
    <div className="author-panel-body author-tool-index-body">
      <label className="author-tool-search">
        <span>FIND</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="find"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query ? <button type="button" aria-label="Clear tool search" onClick={() => setQuery("")}>[CLEAR]</button> : null}
      </label>
      {!normalizedQuery ? groups.map((group) => <section className="author-tool-group" key={group.id}>
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
      </section>) : <section className="author-tool-group author-search-results">
        <h3>SEARCH RESULTS</h3>
        <div className="author-tool-list">
          {results.map((entry) => <button type="button" className={entry.tone === "draft" ? "draft-input" : ""} key={entry.id} onClick={entry.onSelect}>
            <span className="author-tool-copy">
              <strong>{entry.label}</strong>
              <small>{entry.groupLabel} · {entry.description}</small>
            </span>
            <span className="author-tool-arrow" aria-hidden="true">›</span>
          </button>)}
        </div>
      </section>}
      {!visibleCount ? <div className="author-tool-empty" role="status">NOTHING AUTHOR CAN OPEN MATCHES “{query.trim()}”. TRY A CONTROL, CONCEPT, OR AUTHORED NAME.</div> : null}
    </div>
    <footer className="author-panel-footer"><span>{normalizedQuery ? "SEARCHING DESTINATIONS, CONTROLS, CONCEPTS, AND AUTHORED CONTENT." : "SELECT A TOOL OR [X] TO RETURN TO PLAY."}</span></footer>
  </section>;
}
