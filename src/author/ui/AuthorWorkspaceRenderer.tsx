import type { ChangeEvent } from "react";
import type { AuthorUiNode, AuthorWorkspaceSpec } from "./types";
import { assertValidAuthorWorkspaceSpec } from "./validation";
import "./authorUi.css";
import "./authorUiControls.css";

function labelClass(mode: "auto" | "always" | "sr-only" = "auto") {
  return mode === "sr-only" ? "author-ui-sr-only" : `author-ui-label author-ui-label-${mode}`;
}

function effectiveLabelMode(
  mode: "auto" | "always" | "sr-only" | undefined,
  label: string,
  parentLabel?: string,
) {
  if (mode === "always" || mode === "sr-only") return mode;
  return parentLabel?.trim().toLocaleLowerCase() === label.trim().toLocaleLowerCase() ? "sr-only" : mode;
}

function renderNodes(nodes: AuthorUiNode[], parentLabel?: string) {
  return nodes.map((node) => <AuthorUiNodeView node={node} parentLabel={parentLabel} key={node.id} />);
}

function AuthorUiNodeView({ node, parentLabel }: { node: AuthorUiNode; parentLabel?: string }) {
  if (node.type === "field") {
    const common = {
      id: node.id,
      value: node.value,
      placeholder: node.placeholder,
      disabled: node.disabled,
      autoFocus: node.autoFocus,
      enterKeyHint: node.enterKeyHint,
      inputMode: node.inputMode,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => node.onChange(event.target.value),
    };
    return <label className="author-ui-field" htmlFor={node.id}>
      <span className={labelClass(effectiveLabelMode(node.labelMode, node.label, parentLabel))}>{node.label}</span>
      {node.control === "textarea"
        ? <textarea {...common} rows={node.rows ?? 4} />
        : <input {...common} type={node.control === "number" ? "number" : node.control === "search" ? "search" : "text"} />}
      {node.help ? <small className="author-ui-help">{node.help}</small> : null}
    </label>;
  }

  if (node.type === "select") {
    return <label className="author-ui-field author-ui-select-field" htmlFor={node.id}>
      <span className={labelClass(effectiveLabelMode(node.labelMode, node.label, parentLabel))}>{node.label}</span>
      <select id={node.id} value={node.value} disabled={node.disabled} onChange={(event) => node.onChange(event.target.value)}>
        {node.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      {node.help ? <small className="author-ui-help">{node.help}</small> : null}
    </label>;
  }

  if (node.type === "toggle") {
    return <label className="author-ui-toggle" htmlFor={node.id}>
      <input id={node.id} type="checkbox" checked={node.checked} disabled={node.disabled} onChange={(event) => node.onChange(event.target.checked)} />
      <span>{node.label}</span>
      {node.help ? <small className="author-ui-help">{node.help}</small> : null}
    </label>;
  }

  if (node.type === "choice") {
    const selected = node.options.find((option) => option.value === node.value);
    return <fieldset className={`author-ui-choice author-ui-choice-${node.presentation ?? "stacked"}`}>
      <legend className={labelClass(effectiveLabelMode(node.labelMode, node.label, parentLabel))}>{node.label}</legend>
      <div className="author-ui-choice-options">
        {node.options.map((option) => <button
          type="button"
          key={option.value}
          aria-pressed={option.value === node.value}
          onClick={() => node.onChange(option.value)}
        >
          <span>{option.label}</span>
          {option.help ? <small>{option.help}</small> : null}
        </button>)}
      </div>
      {selected?.content?.length ? <div className="author-ui-choice-content">{renderNodes(selected.content, node.label)}</div> : null}
    </fieldset>;
  }

  if (node.type === "section") {
    const labelId = `${node.id}-label`;
    return <section className={`author-ui-section author-ui-section-${node.importance ?? "standard"}`} aria-labelledby={labelId}>
      <div className="author-ui-section-heading">
        <span id={labelId}>{node.label}</span>
        {node.summary ? <small>{node.summary}</small> : null}
      </div>
      <div className="author-ui-section-body">{renderNodes(node.children, node.label)}</div>
    </section>;
  }

  if (node.type === "disclosure") {
    return <details className="author-ui-disclosure" open={node.defaultOpen}>
      <summary><span>{node.label}</span>{node.summary ? <small>{node.summary}</small> : null}</summary>
      <div className="author-ui-disclosure-body">{renderNodes(node.children, node.label)}</div>
    </details>;
  }

  if (node.type === "status") {
    return <div className={`author-ui-status author-ui-status-${node.tone ?? "info"}`} role={node.tone === "error" ? "alert" : "status"}>{node.text}</div>;
  }

  return <div className="author-ui-custom" data-author-ui-role={node.role}>{node.content}</div>;
}

/** Render semantic blocks inside a legacy editor while that editor is migrated. */
export function AuthorUiBlocks({ blocks }: { blocks: AuthorUiNode[] }) {
  return <div className="author-ui-blocks">{renderNodes(blocks)}</div>;
}

/**
 * Canonical renderer for structured Author tasks.
 * Feature code supplies semantic intent only; this component owns task-level
 * title, body hierarchy, responsive presentation, and the one action footer.
 */
export function AuthorWorkspaceRenderer({ spec }: { spec: AuthorWorkspaceSpec }) {
  assertValidAuthorWorkspaceSpec(spec);
  return <section className="author-panel author-panel-frame author-ui-workspace" data-author-ui-workspace={spec.id}>
    <header className="author-ui-workspace-header">
      <span>{spec.title}</span>
      {spec.context ? <small>{spec.context}</small> : null}
    </header>
    <div className="author-panel-body author-ui-workspace-body">
      <AuthorUiBlocks blocks={spec.blocks} />
    </div>
    {spec.actions?.length ? <div className="author-actions author-panel-footer author-ui-workspace-actions">
      {spec.actions.map((action) => <button
        type="button"
        className={action.tone === "danger" ? "danger" : undefined}
        disabled={action.disabled}
        onClick={action.onAction}
        key={action.id}
      >[{action.label}]</button>)}
    </div> : null}
  </section>;
}
