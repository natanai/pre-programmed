import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import { SpeakerPrefix } from "../src/features/world/ui/SpeakerPrefix";
import { node, project } from "./fixtures";

const character = {
  id: "afr-id", key: "afr-id", type: "character" as const, name: "Afridite",
  startingNameSelection: "first" as const, description: "", tags: [],
  aliases: [{ name: "Mysterious Voice", condition: { type: "always" as const } }],
};

describe("player terminal speaker presentation", () => {
  it("renders the actual conditional alias while keeping the Author Edit target", () => {
    const snapshot = project({ nodes: [node("a", 1)], entities: [character] });
    const state = createEmptyPlayState(snapshot);
    const html = renderToStaticMarkup(<SpeakerPrefix
      snapshot={snapshot} state={state} speakerId={character.id} onEdit={() => undefined}
    />);
    expect(html).toContain("Mysterious Voice: ");
    expect(html).toContain("story-speaker-edit");
    expect(html).not.toContain("Afridite:");
  });

  it("keeps historical speaker names stable after a flag-based reveal", () => {
    const snapshot = project({ entities: [{ ...character, aliases: [{
      name: "Mysterious Voice", condition: { type: "flag" as const, key: "hasasked", value: false },
    }] }] });
    const initial = createEmptyPlayState(snapshot);
    const revealed = { ...initial, values: { ...initial.values, hasasked: true } };
    const currentHtml = renderToStaticMarkup(<SpeakerPrefix
      snapshot={snapshot} state={revealed} speakerId={character.id} onEdit={() => undefined}
    />);
    const pastHtml = renderToStaticMarkup(<SpeakerPrefix
      snapshot={snapshot} state={revealed} speakerId={character.id} speakerName="Mysterious Voice" onEdit={() => undefined}
    />);
    expect(currentHtml).toContain("Afridite:");
    expect(pastHtml).toContain("Mysterious Voice:");
  });
});
