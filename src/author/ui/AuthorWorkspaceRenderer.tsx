import type { ChangeEvent } from "react";
import { ReferenceField } from "../resources/ReferenceField";
import { useAuthorCommitPending } from "../tasks/commitState";
import { AuthorInlineDisclosure } from "./AuthorInlineDisclosure";
import { AuthorHelp } from "./AuthorHelp";
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
      maxLength: node.maxLength,
      autoCapitalize: node.autoCapitalize,
      autoCorrect: node.autoCorrect,
      spellCheck: node.spellCheck,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => node.onChange(event.target.value),
    };
    return <div className="author-ui-field">
      <div className="author-ui-field-heading"><label htmlFor={node.id} className={labelClass(effectiveLabelMode(node.labelMode, node.label, parentLabel))}>{node.label}</label>{node.help ? <AuthorHelp text={node.help} label={`About ${node.label}`} /> : null}</div>
      {node.control === "textarea"
        ? <textarea {...common} rows={node.rows ?? 4} />
        : <input
            {...common}
            type={node.control === "number" ? "number" : node.control === "search" ? "search" : "text"}
            min={node.min}
            max={node.max}
            step={node.step}
          />}
      </div>;
  }

  if (node.type === "resource") {
    return <div className="author-ui-field author-ui-resource-field">
      <div className="author-ui-field-heading"><span className={labelClass(effectiveLabelMode(node.labelMode, node.label, parentLabel))}>{node.label}</span>{node.help ? <AuthorHelp text={node.help} label={`About ${node.label}`} /> : null}</div>
      <ReferenceField
        kind={node.kind}
        value={node.value}
        onChange={node.onChange}
        placeholder={node.placeholder}
        allowEmpty={node.allowEmpty}
        showPreview={node.showPreview}
      />
    </div>;
  }

  if (node.type === "select") {
    return <div className="author-ui-field author-ui-select-field">
      <div className="author-ui-field-heading"><label htmlFor={node.id} className={labelClass(effectiveLabelMode(node.labelMode, node.label, parentLabel))}>{node.label}</label>{node.help ? <AuthorHelp text={node.help} label={`About ${node.label}`} /> : null}</div>
      <select id={node.id} value={node.value} disabled={node.disabled} onChange={(event) => node.onChange(event.target.value)}>
        {node.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </div>;
  }

  if (node.type === "toggle") {
    return <div className="author-ui-toggle">
      <input id={node.id} type="checkbox" checked={node.checked} disabled={node.disabled} onChange={(event) => node.onChange(event.target.checked)} />
      <label htmlFor={node.id}>{node.label}</label>
      {node.help ? <AuthorHelp text={node.help} label={`About ${node.label}`} /> : null}
    </div>;
  }

  if (node.type === "choice") {
    const selected = node.options.find((option) => option.value === node.value);
    return <fieldset className={`author-ui-choice author-ui-choice-${node.presentation ?? "stacked"}`}>
      <legend className={labelClass(effectiveLabelMode(node.labelMode, node.label, parentLabel))}>{node.label}</legend>
      <div className="author-ui-choice-options">
        {node.options.map((option) => <div className={`author-ui-choice-option${option.help ? " has-help" : ""}`} key={option.value}>
          <button type="button" aria-pressed={option.value === node.value} onClick={() => node.onChange(option.value)}><span>{option.label}</span></button>
          {option.help ? <AuthorHelp text={option.help} label={`About ${option.label}`} /> : null}
        </div>)}
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
    return <AuthorInlineDisclosure label={node.label} summary={node.summary} defaultOpen={node.defaultOpen}>
      {renderNodes(node.children, node.label)}
    </AuthorInlineDisclosure>;
  }

  if (node.type === "list") {
    return <ul className="author-ui-list" aria-label={node.label}>
      {node.items.map((item) => <li key={item.id}>
        <button type="button" disabled={item.disabled} onClick={item.onAction}>
          <span>{item.label}</span>
          {item.detail ? <small>{item.detail}</small> : null}
        </button>
      </li>)}
    </ul>;
  }

  if (node.type === "action-row") {
    return <div className="author-ui-action-row">
      {node.actions.map((action) => <button
        type="button"
        className={action.tone === "danger" ? "danger" : undefined}
        disabled={action.disabled}
        onClick={action.onAction}
        key={action.id}
      >[{action.label}]</button>)}
    </div>;
  }

  if (node.type === "status") {
    return <div className={`author-ui-status author-ui-status-${node.tone ?? "info"}`} role={node.tone === "error" ? "alert" : "status"}>{node.text}</div>;
  }

  return <div className="author-ui-custom" data-author-ui-role={node.role}>{node.content}</div>;
}

/** Render semantic blocks within the shared structured Author hierarchy. */
export function AuthorUiBlocks({ blocks }: { blocks: AuthorUiNode[] }) {
  return <div className="author-ui-blocks">{renderNodes(blocks)}</div>;
}

/**
 * Canonical renderer for structured Author task bodies.
 * The nested Author task shell owns the one visible task title/navigation header;
 * feature workspaces own only their body hierarchy, optional context, and action footer.
 * Structured workspaces deliberately do not use the legacy three-row
 * author-panel-frame because they have no feature-owned header row.
 */
export function AuthorWorkspaceRenderer({ spec, busy = false }: { spec: AuthorWorkspaceSpec; busy?: boolean }) {
  assertValidAuthorWorkspaceSpec(spec);
  const commitPending = useAuthorCommitPending();
  const locked = busy || commitPending;
  // A different task may be saving in the background. Do not make this
  // editor inert during that commit: Chromium immediately drops textarea
  // focus, and Windows authors cannot click or type until persistence finishes.
  // Only this workspace's own explicit Save temporarily freezes its draft.
  return <section
    className="author-panel author-ui-workspace"
    data-author-ui-workspace={spec.id}
    aria-label={spec.title}
    aria-busy={locked || undefined}
    inert={busy || undefined}
  >
    <div className="author-panel-body author-ui-workspace-body">
      {spec.context ? <small className="author-ui-workspace-context">{spec.context}</small> : null}
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
