import type { ReactNode } from "react";
import "./authorInlineDisclosure.css";

export function AuthorInlineDisclosure({
  label,
  summary,
  children,
  defaultOpen = false,
  className = "",
}: {
  label: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const classes = ["author-inline-disclosure", className].filter(Boolean).join(" ");
  return <details className={classes} open={defaultOpen}>
    <summary>
      <span className="author-inline-disclosure-label">{label}</span>
      {summary === undefined || summary === null
        ? <span className="author-inline-disclosure-summary" aria-hidden="true" />
        : <small className="author-inline-disclosure-summary">{summary}</small>}
      <span className="author-inline-disclosure-chevron" aria-hidden="true">›</span>
    </summary>
    <div className="author-inline-disclosure-body">{children}</div>
  </details>;
}
