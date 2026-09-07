import type { AuthorUiNode, AuthorWorkspaceSpec } from "./types";

function normalizedLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * Validate the stable Author UI grammar rather than any one feature layout.
 *
 * The important invariant is that navigation hierarchy cannot grow recursively
 * inside a task. A task has one title, optional root sections, and semantic
 * controls beneath them. Choices may nest because they represent decisions, not
 * navigation headings, but their depth is capped so a feature cannot recreate a
 * breadcrumb tree inside one workspace.
 */
export function validateAuthorWorkspaceSpec(spec: AuthorWorkspaceSpec) {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (!spec.id.trim()) errors.push("Workspace id is required.");
  if (!spec.title.trim()) errors.push("Workspace title is required.");

  const registerId = (id: string, path: string) => {
    if (!id.trim()) {
      errors.push(`${path} requires a stable id.`);
      return;
    }
    if (ids.has(id)) errors.push(`${path} reuses id “${id}”.`);
    ids.add(id);
  };

  const repeatedParentLabel = (node: { label: string; labelMode?: string }, path: string, parentLabel?: string) => {
    if (
      node.labelMode !== "sr-only"
      && parentLabel
      && normalizedLabel(node.label) === normalizedLabel(parentLabel)
    ) errors.push(`${path} repeats its parent label; use a distinct control label or sr-only label.`);
  };

  const visit = (
    node: AuthorUiNode,
    path: string,
    sectionDepth: number,
    choiceDepth: number,
    parentLabel?: string,
  ) => {
    registerId(node.id, path);

    if ("label" in node && !node.label.trim()) errors.push(`${path} requires a label.`);

    if (node.type === "field" || node.type === "resource") {
      repeatedParentLabel(node, path, parentLabel);
      if (node.type === "resource" && !node.kind.trim()) errors.push(`${path} requires a resource kind.`);
      return;
    }

    if (node.type === "select") {
      repeatedParentLabel(node, path, parentLabel);
      if (!node.options.length) errors.push(`${path} requires at least one option.`);
      const optionValues = new Set<string>();
      node.options.forEach((option, optionIndex) => {
        if (!option.label.trim()) errors.push(`${path}.options[${optionIndex}] requires a label.`);
        if (optionValues.has(option.value)) errors.push(`${path} repeats option value “${option.value}”.`);
        optionValues.add(option.value);
      });
      if (!optionValues.has(node.value)) errors.push(`${path} selects unknown option “${node.value}”.`);
      return;
    }

    if (node.type === "toggle") {
      repeatedParentLabel(node, path, parentLabel);
      return;
    }

    if (node.type === "section") {
      if (sectionDepth > 0) {
        errors.push(`${path} nests a section inside another section. Start a subtask instead of creating another heading level.`);
      }
      node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, sectionDepth + 1, choiceDepth, node.label));
      return;
    }

    if (node.type === "choice") {
      if (choiceDepth >= 3) {
        errors.push(`${path} exceeds three nested decision levels. Split deeper work into a subtask.`);
      }
      if (!node.options.length) errors.push(`${path} requires at least one option.`);
      const optionValues = new Set<string>();
      node.options.forEach((option, optionIndex) => {
        if (!option.value.trim()) errors.push(`${path}.options[${optionIndex}] requires a value.`);
        if (!option.label.trim()) errors.push(`${path}.options[${optionIndex}] requires a label.`);
        if (optionValues.has(option.value)) errors.push(`${path} repeats option value “${option.value}”.`);
        optionValues.add(option.value);
        option.content?.forEach((child, childIndex) => visit(
          child,
          `${path}.options[${optionIndex}].content[${childIndex}]`,
          sectionDepth,
          choiceDepth + 1,
          option.label,
        ));
      });
      if (node.value && !optionValues.has(node.value)) errors.push(`${path} selects unknown option “${node.value}”.`);
      return;
    }

    if (node.type === "disclosure") {
      node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, sectionDepth, choiceDepth, node.label));
    }
  };

  spec.blocks.forEach((node, index) => visit(node, `blocks[${index}]`, 0, 0));
  spec.actions?.forEach((action, index) => registerId(action.id, `actions[${index}]`));

  return errors;
}

export function assertValidAuthorWorkspaceSpec(spec: AuthorWorkspaceSpec) {
  const errors = validateAuthorWorkspaceSpec(spec);
  if (!errors.length) return spec;
  throw new Error(`Invalid Author workspace “${spec.id}”:\n- ${errors.join("\n- ")}`);
}
