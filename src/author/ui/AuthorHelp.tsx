import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import "./authorHelp.css";

/** One optional help affordance for mouse, keyboard, and touch authors. */
export function AuthorHelp({ text, label = "More information" }: { text: string; label?: string }) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const visible = hovered || expanded;
  const rect = buttonRef.current?.getBoundingClientRect();
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const width = Math.max(160, Math.min(330, viewportWidth - 24));
  const left = rect ? Math.max(12, Math.min(rect.left, viewportWidth - width - 12)) : 12;
  const above = Boolean(rect && rect.bottom + 160 > viewportHeight && rect.top > 170);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => { setHovered(false); setExpanded(false); };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [visible]);

  return <span className="author-inline-help">
    <button
      ref={buttonRef}
      type="button"
      className="author-inline-help-trigger"
      aria-label={label}
      aria-expanded={expanded}
      aria-describedby={visible ? id : undefined}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
      onClick={() => setExpanded((current) => !current)}
      onBlur={() => setExpanded(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setExpanded(false);
          setHovered(false);
        }
      }}
    >[?]</button>
    {visible && rect ? createPortal(<span
      id={id}
      role="tooltip"
      className="author-help-popover"
      style={{
        width,
        left,
        ...(above ? { bottom: viewportHeight - rect.top + 5 } : { top: rect.bottom + 5 }),
      }}
    >{text}</span>, document.body) : null}
  </span>;
}
