import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { AuthorPicker, type AuthorPickerGroup } from "../picker/AuthorPicker";
import { searchAuthorEntries } from "./authorSearch";
import type { AuthorSearchEntry } from "./types";

export function AuthorQuickFind({ entries }: { entries: readonly AuthorSearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const results = useMemo(() => query.trim() ? searchAuthorEntries(entries, query, 12) : [], [entries, query]);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const groups = useMemo<AuthorPickerGroup[]>(() => {
    const grouped = new Map<string, AuthorSearchEntry[]>();
    for (const entry of results) {
      const current = grouped.get(entry.groupLabel) ?? [];
      current.push(entry);
      grouped.set(entry.groupLabel, current);
    }
    return [...grouped.entries()].map(([label, groupEntries]) => ({
      id: label,
      label: label.toUpperCase(),
      items: groupEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        detail: entry.description,
        onSelect: () => {
          close();
          entry.onSelect();
        },
      })),
    }));
  }, [results, close]);

  return <div className="author-quick-find">
    <button ref={trigger} type="button" aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>
      [{open ? "CLOSE FIND" : "FIND"}]
    </button>
    <AuthorPicker
      open={open}
      title="FIND ANYTHING"
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      placeholder="tool, rule, command, item, scene..."
      emptyText={query.trim() ? "NO MATCH. TRY A CONCEPT, CONTROL, OR AUTHORED NAME." : "TYPE TO SEARCH..."}
      onClose={close}
      anchorRef={trigger as RefObject<HTMLElement | null>}
    />
  </div>;
}
