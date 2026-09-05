import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import "./authorPicker.css";

export type AuthorPickerItem = {
  id: string;
  label: string;
  detail?: string;
  meta?: string;
  onSelect: () => void;
  secondary?: {
    label: string;
    ariaLabel?: string;
    onSelect: () => void;
  };
  choices?: readonly {
    id: string;
    label: string;
    ariaLabel?: string;
    onSelect: () => void;
  }[];
};

export type AuthorPickerGroup = {
  id: string;
  label: string;
  items: readonly AuthorPickerItem[];
};

export type AuthorPickerAction = {
  id: string;
  label: string;
  onSelect: () => void;
};

type PickerPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

export function AuthorPicker({
  open,
  title,
  query,
  onQueryChange,
  groups,
  actions = [],
  placeholder = "Search...",
  emptyText = "NO MATCH",
  onClose,
  anchorRef,
}: {
  open: boolean;
  title: string;
  query: string;
  onQueryChange: (value: string) => void;
  groups: readonly AuthorPickerGroup[];
  actions?: readonly AuthorPickerAction[];
  placeholder?: string;
  emptyText?: string;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const panel = useRef<HTMLElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const updatePosition = () => {
    const anchor = anchorRef?.current;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(560, Math.max(300, viewportWidth - margin * 2));
    if (!anchor) {
      setPosition({
        left: Math.max(margin, (viewportWidth - width) / 2),
        width,
        top: margin,
        maxHeight: Math.max(220, viewportHeight - margin * 2),
      });
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
    const below = viewportHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const useAbove = below < 260 && above > below;
    if (useAbove) {
      setPosition({
        left,
        width,
        bottom: Math.max(margin, viewportHeight - rect.top + 6),
        maxHeight: Math.max(220, Math.min(480, above - 6)),
      });
      return;
    }
    setPosition({
      left,
      width,
      top: Math.max(margin, rect.bottom + 6),
      maxHeight: Math.max(220, Math.min(480, below - 6)),
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(() => search.current?.focus({ preventScroll: true }));
    const reposition = () => updatePosition();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (panel.current?.contains(target) || anchorRef?.current?.contains(target))) return;
      onClose();
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [open, anchorRef, onClose]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open || !items.length) return;
    const selected = panel.current?.querySelector<HTMLElement>(`[data-author-picker-index="${activeIndex % items.length}"]`);
    selected?.scrollIntoView({ block: "nearest" });
  }, [open, items.length, activeIndex]);

  if (!open || !position) return null;

  let index = -1;
  const surface = <section
    ref={panel}
    className="author-picker-surface"
    role="dialog"
    aria-label={title}
    style={{
      left: position.left,
      width: position.width,
      top: position.top,
      bottom: position.bottom,
      maxHeight: position.maxHeight,
    } satisfies CSSProperties}
  >
    <header className="author-picker-header">
      <div className="author-picker-title-row">
        <strong>{title}</strong>
        <button type="button" className="author-picker-close" aria-label={`Close ${title}`} onClick={onClose}>[X]</button>
      </div>
      <input
        ref={search}
        className="author-picker-search"
        type="search"
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (!items.length) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) => (current + direction + items.length) % items.length);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            items[activeIndex % items.length].onSelect();
          }
        }}
      />
    </header>
    <div className="author-picker-results" role="listbox">
      {groups.map((group) => group.items.length ? <section className="author-picker-group" key={group.id}>
        <div className="author-picker-group-label">{group.label}</div>
        {group.items.map((item) => {
          index += 1;
          const itemIndex = index;
          return <div className="author-picker-row" key={item.id} data-author-picker-index={itemIndex}>
            <button
              type="button"
              className="author-picker-primary"
              role="option"
              aria-selected={itemIndex === activeIndex % Math.max(1, items.length)}
              onClick={item.onSelect}
            >
              <span className="author-picker-copy">
                <strong>{item.label}</strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </span>
              {item.meta ? <span className="author-picker-meta">{item.meta}</span> : null}
            </button>
            {item.secondary ? <button
              type="button"
              className="author-picker-secondary"
              aria-label={item.secondary.ariaLabel ?? item.secondary.label}
              onClick={item.secondary.onSelect}
            >{item.secondary.label}</button> : null}
            {item.choices?.length ? <div className="author-picker-choices" aria-label={`Choose ${item.label} value`}>
              <span>AS:</span>
              {item.choices.map((choice) => <button
                type="button"
                key={choice.id}
                aria-label={choice.ariaLabel ?? choice.label}
                onClick={choice.onSelect}
              >{choice.label}</button>)}
            </div> : null}
          </div>;
        })}
      </section> : null)}
      {!items.length ? <div className="author-picker-empty">{emptyText}</div> : null}
    </div>
    {actions.length ? <footer className="author-picker-actions">
      {actions.map((action) => <button type="button" key={action.id} onClick={action.onSelect}>{action.label}</button>)}
    </footer> : null}
  </section>;

  return createPortal(surface, document.body);
}
