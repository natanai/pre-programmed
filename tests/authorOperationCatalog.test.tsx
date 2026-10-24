import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperationHooksEditor } from "../src/author/operations/OperationHooksEditor";
import { authorOperationDefinitions } from "../src/author/operations/catalog";
import type { ProjectSnapshot } from "../src/engine/project/model";
import type { CommandDefinition } from "../src/features/commands/model";
import { project } from "./fixtures";

function projectWithCommands(commands: CommandDefinition[]): ProjectSnapshot {
  const base = project();
  return project({
    settings: {
      ...base.settings,
      commands: { ...base.settings.commands, commands },
    },
  });
}

function targetCommand(
  id: string,
  operation: string,
  targetKind: string,
  enabled = true,
): CommandDefinition {
  return {
    id,
    label: id,
    enabled,
    patterns: [`${operation} {target}`],
    slots: [{ name: "target", sourceKinds: [targetKind] }],
    action: { type: "target-operation", operation, targetSlot: "target" },
  };
}

describe("Player Language owns the authoring vocabulary for target operations", () => {
  it("does not install implicit inspect/enter or inventory operations", () => {
    const snapshot = project();
    expect(authorOperationDefinitions(snapshot, "world.location")).toEqual([]);
    expect(authorOperationDefinitions(snapshot, "world.character")).toEqual([]);
    expect(authorOperationDefinitions(snapshot, "inventory.item")).toEqual([]);
  });

  it("shows only enabled targeted commands for the requested target type", () => {
    const snapshot = projectWithCommands([
      targetCommand("Approach", "approach", "world.location"),
      targetCommand("Visit", "visit", "world.location"),
      targetCommand("Talk", "speak", "world.character"),
      targetCommand("Inventory action", "move", "inventory.item"),
      targetCommand("Disabled", "hide", "world.location", false),
      {
        id: "response",
        label: "A response command",
        enabled: true,
        patterns: ["wave"],
        slots: [],
        action: {
          type: "response",
          responseText: "Hello",
          responsePerformance: { charactersPerSecond: 18, cues: [] },
          speakerId: null,
          effects: [],
        },
      },
      targetCommand("Approach synonym", "approach", "world.location"),
    ]);
    expect(authorOperationDefinitions(snapshot, "world.location")).toEqual([
      { value: "approach", label: "Approach", commandId: "Approach" },
      { value: "visit", label: "Visit", commandId: "Visit" },
    ]);
    expect(authorOperationDefinitions(snapshot, "world.character")).toEqual([
      { value: "speak", label: "Talk", commandId: "Talk" },
    ]);
    expect(authorOperationDefinitions(snapshot, "inventory.item")).toEqual([
      { value: "move", label: "Inventory action", commandId: "Inventory action" },
    ]);
  });

  it("does not show obsolete actions just because a target stored an operation or hook", () => {
    const snapshot = project({
      entities: [{
        id: "hall",
        type: "location",
        name: "Hall",
        key: "hall",
        tags: [],
        description: "",
        interactable: true,
        operations: ["enter"],
        hooks: [],
      }],
    });
    const html = renderToStaticMarkup(
      <OperationHooksEditor
        capability={{ interactable: true, operations: ["enter"], hooks: [] }}
        snapshot={snapshot}
        targetKind="world.location"
        onChange={() => undefined}
        onOpenPlayerLanguage={() => undefined}
        onCreatePlayerCommand={() => undefined}
      />,
    );
    expect(html).toContain("No targeted Player Commands exist");
    expect(html).toContain("[PLAYER LANGUAGE]");
    expect(html).toContain("[+ PLAYER COMMAND]");
    expect(html).not.toContain("[+ ENTER RESPONSE]");
  });

  it("exposes the owning Player Command beside an authored target operation", () => {
    const snapshot = projectWithCommands([targetCommand("Approach", "approach", "world.location")]);
    const html = renderToStaticMarkup(
      <OperationHooksEditor
        capability={{ interactable: true, operations: [], hooks: [] }}
        snapshot={snapshot}
        targetKind="world.location"
        onChange={() => undefined}
        onEditPlayerCommand={() => undefined}
      />,
    );
    expect(html).toContain("[EDIT PLAYER COMMAND]");
    expect(html).toContain("[+ APPROACH RESPONSE]");
    expect(html).not.toContain("[+ INSPECT RESPONSE]");
    expect(html).not.toContain("[+ ENTER RESPONSE]");
  });
});
