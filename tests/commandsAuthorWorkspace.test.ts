import { describe, expect, it } from "vitest";
import type { AuthorWorkspaceContext } from "../src/author/features/types";
import type { AuthorUiNode, AuthorWorkspaceSpec } from "../src/author/ui/types";
import { validateAuthorWorkspaceSpec } from "../src/author/ui/validation";
import { createEmptyPlayState } from "../src/engine/project/playState";
import type { ProjectSnapshot } from "../src/engine/project/model";
import { commandWorkspace } from "../src/features/commands/author/commandWorkspace";
import { commandReferenceSourceWorkspace } from "../src/features/commands/author/structuredWorkspaces";
import { project } from "./fixtures";

function authorContext(snapshot: ProjectSnapshot): AuthorWorkspaceContext {
  const playState = createEmptyPlayState(snapshot);
  return {
    taskId: "test-task",
    hasParentTask: false,
    snapshot,
    playState,
    authorMode: true,
    authorToken: "test",
    persist: async () => ({ status: "saved", snapshot }),
    completeTask: () => undefined,
    leaveCurrentTask: () => undefined,
    setWorkspaceDirty: () => undefined,
    registerWorkspaceSave: () => undefined,
    pushTask: () => "child-task",
    resources: {
      options: () => [],
      label: (kind) => kind,
      preview: () => null,
      canOpenList: () => false,
      canCreate: () => false,
      canEdit: () => false,
      openList: () => undefined,
      create: () => undefined,
      edit: () => undefined,
    },
    resolveCommandTarget: () => undefined,
    runtime: {
      updateState: () => undefined,
      output: () => undefined,
      events: () => undefined,
      preview: () => undefined,
      tryInput: () => undefined,
    },
    onSnapshot: () => undefined,
    onRestore: () => undefined,
  } as AuthorWorkspaceContext;
}

function buildWorkspace(
  definition: typeof commandWorkspace,
  route: Extract<Parameters<typeof definition.createDraft>[0], { type: "feature" }>,
  context: AuthorWorkspaceContext,
) {
  let draft = definition.createDraft(route, context);
  const setDraft = (update: typeof draft | ((current: typeof draft) => typeof draft)) => {
    draft = typeof update === "function" ? update(draft) : update;
  };
  const spec = () => definition.buildSpec({
    route,
    context,
    draft,
    setDraft,
    dirty: false,
    adoptLoadedDraft: (next) => { draft = next; },
    saveCurrentDraft: async () => true,
  });
  return { get draft() { return draft; }, setDraft, spec };
}

function findNode(spec: AuthorWorkspaceSpec, id: string): AuthorUiNode | undefined {
  const visit = (nodes: AuthorUiNode[]): AuthorUiNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.type === "section" || node.type === "disclosure") {
        const nested = visit(node.children);
        if (nested) return nested;
      }
      if (node.type === "choice") {
        for (const option of node.options) {
          const nested = option.content ? visit(option.content) : undefined;
          if (nested) return nested;
        }
      }
    }
    return undefined;
  };
  return visit(spec.blocks);
}

describe("Commands Author structured workspace grammar", () => {
  it("validates a target command with a player-supplied placeholder", () => {
    const base = project();
    const snapshot = project({
      settings: {
        ...base.settings,
        commands: {
          ...base.settings.commands,
          commands: [{
            id: "inspect-character",
            label: "Inspect character",
            enabled: true,
            patterns: ["inspect {target}"],
            slots: [{ name: "target", sourceKinds: ["world.character"] }],
            action: { type: "target-operation", operation: "inspect", targetSlot: "target" },
          }],
        },
      },
    });
    const context = authorContext(snapshot);
    const route = {
      type: "feature" as const,
      feature: "commands",
      workspace: "command",
      data: { commandId: "inspect-character" },
    };
    const workspace = buildWorkspace(commandWorkspace, route, context);

    expect(validateAuthorWorkspaceSpec(workspace.spec())).toEqual([]);
  });

  it("normalizes a removed or renamed target placeholder before rebuilding the select", () => {
    const base = project();
    const snapshot = project({
      settings: {
        ...base.settings,
        commands: {
          ...base.settings.commands,
          commands: [{
            id: "inspect-thing",
            label: "Inspect",
            enabled: true,
            patterns: ["inspect {thing}"],
            slots: [{ name: "thing", sourceKinds: ["world.character"] }],
            action: { type: "target-operation", operation: "inspect", targetSlot: "thing" },
          }],
        },
      },
    });
    const context = authorContext(snapshot);
    const route = {
      type: "feature" as const,
      feature: "commands",
      workspace: "command",
      data: { commandId: "inspect-thing" },
    };
    const workspace = buildWorkspace(commandWorkspace, route, context);
    const patterns = findNode(workspace.spec(), "command-patterns");
    expect(patterns?.type).toBe("field");
    if (!patterns || patterns.type !== "field") throw new Error("Player inputs field missing");

    patterns.onChange("inspect");
    const withoutSlot = workspace.spec();
    expect(validateAuthorWorkspaceSpec(withoutSlot)).toEqual([]);
    const targetSelect = findNode(withoutSlot, "command-target-slot");
    expect(targetSelect?.type).toBe("select");
    if (!targetSelect || targetSelect.type !== "select") throw new Error("Target input select missing");
    expect(targetSelect.value).toBe("");

    const nextPatterns = findNode(withoutSlot, "command-patterns");
    if (!nextPatterns || nextPatterns.type !== "field") throw new Error("Player inputs field missing");
    nextPatterns.onChange("inspect {item}");
    const renamed = workspace.spec();
    expect(validateAuthorWorkspaceSpec(renamed)).toEqual([]);
    const renamedTarget = findNode(renamed, "command-target-slot");
    expect(renamedTarget?.type).toBe("select");
    if (!renamedTarget || renamedTarget.type !== "select") throw new Error("Target input select missing");
    expect(renamedTarget.value).toBe("");
    expect(renamedTarget.options.some((option) => option.value === "item")).toBe(true);
  });

  it("validates Target Names + Aliases with real target candidates", () => {
    const base = project();
    const snapshot = project({
      settings: {
        ...base.settings,
        commands: {
          ...base.settings.commands,
          referenceSources: [{ sourceKind: "world.character", enabled: true, includeDefaults: true, aliases: {} }],
        },
      },
      entities: [{
        id: "marta",
        type: "character",
        key: "marta",
        name: "Marta",
        description: "A test character.",
        tags: [],
      }],
    });
    const context = authorContext(snapshot);
    const route = {
      type: "feature" as const,
      feature: "commands",
      workspace: "reference-source",
      data: { sourceKind: "world.character" },
    };
    const draft = commandReferenceSourceWorkspace.createDraft(route, context);
    const spec = commandReferenceSourceWorkspace.buildSpec({
      route,
      context,
      draft,
      setDraft: () => undefined,
      dirty: false,
      adoptLoadedDraft: () => undefined,
      saveCurrentDraft: async () => true,
    });

    expect(validateAuthorWorkspaceSpec(spec)).toEqual([]);
  });
});
