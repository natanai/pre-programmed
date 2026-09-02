import { useMemo, useState } from "react";
import { searchAuthorEntries } from "./authorSearch";
import type { AuthorSearchEntry } from "./types";

export function AuthorQuickFind({ entries }: { entries: readonly AuthorSearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchAuthorEntries(entries, query, 12), [entries, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return <div className={`author-quick-find${open ? " is-open" : ""}`}>
    <button type="button" aria-expanded={open} aria-controls="author-quick-find-panel" onClick={() => open ? close() : setOpen(true)}>
      [{open ? "CLOSE FIND" : "FIND"}]
    </button>
    {open ? <section id="author-quick-find-panel" className="author-quick-find-panel" role="search" aria-label="Find any Author tool or authored resource">
      <label>
        <span>FIND ANYTHING</span>
        <input
          type="search"
          autoFocus
          value={query}
          placeholder="tool, rule, command, item, scene..."
          onChange={(event) => setQuery(event.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {query.trim() ? <div className="author-quick-find-results">
        {results.map((entry) => <button type="button" key={entry.id} onClick={() => { close(); entry.onSelect(); }}>
          <span><strong>{entry.label}</strong><small>{entry.groupLabel} · {entry.description}</small></span><span aria-hidden="true">›</span>
        </button>)}
        {!results.length ? <span className="author-quick-find-empty">NO MATCH. TRY A CONCEPT, CONTROL, OR AUTHORED NAME.</span> : null}
      </div> : <p>Search remains available while nested work stays safely suspended.</p>}
    </section> : null}
  </div>;
}
