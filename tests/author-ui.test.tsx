import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AssetExplorer, SynthPanel } from "../src/components/AuthorTools";
import { DefinitionsPanel } from "../src/components/DefinitionsPanel";
import { aliasesForUserInput, InteractionEditor, QuickInputsEditor } from "../src/components/InteractionEditor";
import { Inventory } from "../src/components/Inventory";
import { NodeEditor } from "../src/components/NodeEditor";
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
      renderToStaticMarkup(<QuickInputsEditor snapshot={snapshot} playState={state} onSave={save} onCancel={noop} />),
      renderToStaticMarkup(<DefinitionsPanel snapshot={snapshot} onSave={save} onClose={noop} />),
      renderToStaticMarkup(<StructureNavigator snapshot={snapshot} playState={state} onOpenNode={noop} onEditInteraction={noop} onClose={noop} />),
      renderToStaticMarkup(<AssetExplorer snapshot={snapshot} onClose={noop} />),
      renderToStaticMarkup(<SynthPanel snapshot={snapshot} onSave={save} onClose={noop} />),
      renderToStaticMarkup(<Inventory snapshot={snapshot} state={state} authorMode onState={noop} onOutput={noop} onEvents={noop} onEditItem={noop} onCreateItem={noop} onClose={noop} />),
    ].join("\n");

    for (const label of [
      "NODE #1",
      "USER INPUT FROM #1",
      "QUICK USER INPUTS FROM #1",
      "STATE DEFINITIONS",
      "STRUCTURE FROM HERE",
      "REPOSITORY ASSETS",
      "TINY SYNTH",
      "INVENTORY / STATUS",
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("SAVE &amp; PLAY");
    expect(markup.indexOf("USER-INPUT-TEXT")).toBeLessThan(markup.indexOf("RESPONSE-TEXT"));
    expect(markup).toContain("[ALIASES + AUTHOR DETAILS]");
    expect(markup).toContain("[SHOW ON TAP]");
    expect(markup).toContain("[D] ASSIGN BEHAVIOR");
    expect(markup).toContain("[DEFAULT INVENTORY + ITEM DEFINITIONS]");
    expect(markup).toContain("Inventory cell 10, 6");
  });

  it("generates the primary parser alias while keeping alternate aliases compact", () => {
    expect(aliasesForUserInput("  Open the door  ", ["open-the-door", "pull the door", "pull the door"]))
      .toEqual(["Open the door", "open-the-door", "pull the door"]);
  });
});
