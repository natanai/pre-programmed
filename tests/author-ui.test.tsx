import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AssetExplorer, SynthPanel } from "../src/components/AuthorTools";
import { AuthorSettings } from "../src/components/AuthorSettings";
import { DefinitionsPanel } from "../src/components/DefinitionsPanel";
import { aliasesForUserInput, InteractionEditor } from "../src/components/InteractionEditor";
import { Inventory, ItemEditor } from "../src/components/Inventory";
import { NodeEditor } from "../src/components/NodeEditor";
import { OperationHooksEditor } from "../src/components/OperationHooksEditor";
import { StructureNavigator } from "../src/components/StructureNavigator";
import { createEmptyPlayState } from "../src/game/model";
import { interaction, node, project } from "./fixtures";

const snapshot = project({
  nodes: [node("a", 1), node("b", 2)],
  interactions: [interaction("forward", "a", "b")],
});
const state = createEmptyPlayState(snapshot);
const save = vi.fn(async () => undefined);
const noop = () => undefined;

describe("Author surface rendering", () => {
  it("renders every core contextual author surface from the shared project model", () => {
    const markup = [
      renderToStaticMarkup(<NodeEditor node={snapshot.nodes[0]} snapshot={snapshot} onSave={save} onCancel={noop} />),
      renderToStaticMarkup(<InteractionEditor snapshot={snapshot} playState={state} onSave={save} onCancel={noop} />),
      renderToStaticMarkup(<DefinitionsPanel snapshot={snapshot} onSave={save} onClose={noop} />),
      renderToStaticMarkup(<StructureNavigator snapshot={snapshot} playState={state} onOpenNode={noop} onEditInteraction={noop} onClose={noop} />),
      renderToStaticMarkup(<AssetExplorer snapshot={snapshot} onClose={noop} />),
      renderToStaticMarkup(<SynthPanel snapshot={snapshot} onSave={save} onClose={noop} />),
      renderToStaticMarkup(<Inventory snapshot={snapshot} state={state} authorMode onState={noop} onOutput={noop} onEvents={noop} onEditItem={noop} onCreateItem={noop} onSave={save} onClose={noop} />),
      renderToStaticMarkup(<ItemEditor snapshot={snapshot} onSave={save} onCancel={noop} />),
      renderToStaticMarkup(<OperationHooksEditor snapshot={snapshot} capability={{ interactable: true, operations: ["inspect"], hooks: [] }} onChange={noop} />),
    ].join("\n");

    for (const label of [
      "NODE #1",
      "USER INPUT FROM #1",
      "STATE DEFINITIONS",
      "STRUCTURE FROM HERE",
      "REPOSITORY ASSETS",
      "TINY SYNTH",
      "INVENTORY / STATUS",
      "ITEM DEFINITION",
      "PLAYER OPERATIONS",
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("SAVE &amp; PLAY");
    expect(markup.indexOf("USER-INPUT-TEXT")).toBeLessThan(markup.indexOf("RESPONSE-TEXT"));
    expect(markup).toContain("[ALIASES + AUTHOR DETAILS]");
    expect(markup).toContain("[TEXT SPEED: 18 CHARACTERS/SECOND]");
    expect(markup).toContain("[CUES + NODE DETAILS]");
    expect(markup).toContain("[ON PROMPT]");
    expect(markup).toContain("[D] ASSIGN BEHAVIOR");
    expect(markup).toContain("[+ DRAFT RESPONSE [D]]");
    expect(markup).toContain("[DEFAULT INVENTORY + ITEM DEFINITIONS]");
    expect(markup).toContain("DEFAULT QUANTITY");
    expect(markup).toContain("Inventory cell 10, 6");
  });

  it("generates the primary parser alias while keeping alternate aliases compact", () => {
    expect(aliasesForUserInput("  Open the door  ", ["open-the-door", "pull the door", "pull the door"]))
      .toEqual(["Open the door", "open-the-door", "pull the door"]);
  });

  it("keeps mobile dialogue editing causal and its actions outside the scrolling body", () => {
    const markup = renderToStaticMarkup(<InteractionEditor snapshot={snapshot} playState={state} onSave={save} onCancel={noop} />);
    const userInput = markup.indexOf("USER-INPUT-TEXT");
    const response = markup.indexOf("RESPONSE-TEXT");
    const choice = markup.indexOf("CHOICE: ON PROMPT");
    const bodyEnd = markup.indexOf("</div><div class=\"author-actions author-panel-footer\"");

    expect(markup).toContain("author-panel-frame interaction-editor-panel");
    expect(markup).toContain("author-panel-body");
    expect(markup).toContain("author-panel-footer");
    expect(userInput).toBeLessThan(response);
    expect(response).toBeLessThan(choice);
    expect(bodyEnd).toBeGreaterThan(choice);
  });

  it("renders status capabilities as touch-reachable controls and keeps the corner toggle unlabeled", () => {
    const statusSnapshot = project({ variables: [{
      id: "count", key: "count", label: "Count", valueType: "number", initialValue: 0,
      showInStatus: true, interactable: true, operations: ["inspect"], hooks: [],
    }] });
    const statusState = createEmptyPlayState(statusSnapshot);
    const inventoryMarkup = renderToStaticMarkup(<Inventory snapshot={statusSnapshot} state={statusState} authorMode={false}
      onState={noop} onOutput={noop} onEvents={noop} onEditItem={noop} onCreateItem={noop} onSave={save} onClose={noop} />);
    const settingsMarkup = renderToStaticMarkup(<AuthorSettings authorView onToggleAuthorView={noop} />);

    expect(inventoryMarkup).toContain("<button type=\"button\" aria-pressed=\"false\"><span>Count</span>");
    expect(settingsMarkup).toContain("class=\"author-view-toggle\"");
    expect(settingsMarkup).toContain("aria-label=\"Preview player experience\"");
  });
});
