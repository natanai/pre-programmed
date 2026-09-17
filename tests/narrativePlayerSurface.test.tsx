import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyPlayState } from "../src/engine/project/playState";
import type { PlayState, ProjectSnapshot } from "../src/engine/project/model";
import { useNarrativePlayerSurface } from "../src/features/narrative/runtime/useNarrativePlayerSurface";
import { interaction, project } from "./fixtures";

function SurfaceProbe({ snapshot, state }: { snapshot: ProjectSnapshot; state: PlayState }) {
  const surface = useNarrativePlayerSurface(snapshot, state);
  return <div
    data-immediate={surface.immediateChoices.length}
    data-prompt={surface.promptChoices.length}
  >
    {[...surface.immediateChoices, ...surface.promptChoices].map((choice) => <span key={choice.id}>{choice.text}</span>)}
  </div>;
}

describe("Narrative player terminal surface", () => {
  it("shows authored suggestions during ordinary command input", () => {
    const immediate = { ...interaction("look", "a", null, ["look around"]), choiceVisibility: "immediate" as const };
    const prompt = interaction("question", "a", null, ["why am I here?"]);
    const snapshot = project({ interactions: [immediate, prompt] });
    const state = createEmptyPlayState(snapshot, 0);

    const html = renderToStaticMarkup(<SurfaceProbe snapshot={snapshot} state={state} />);

    expect(html).toContain('data-immediate="1"');
    expect(html).toContain('data-prompt="1"');
    expect(html).toContain("look around");
    expect(html).toContain("why am I here?");
  });

  it("hides all authored suggestions while the next submission is captured as data", () => {
    const askName = interaction("ask-name", "a", null, ["tell my name"]);
    askName.outcomes[0] = {
      ...askName.outcomes[0],
      responseText: "Who are you?",
      inputCapture: {
        effects: [],
        disposition: "stay",
        destination: null,
      },
    };
    const immediate = { ...interaction("look", "a", null, ["look around"]), choiceVisibility: "immediate" as const };
    const prompt = interaction("question", "a", null, ["why am I here?"]);
    const snapshot = project({ interactions: [askName, immediate, prompt] });
    const initial = createEmptyPlayState(snapshot, 0);
    const state: PlayState = {
      ...initial,
      pendingInputCapture: {
        interactionId: askName.id,
        outcomeId: askName.outcomes[0].id,
      },
    };

    const html = renderToStaticMarkup(<SurfaceProbe snapshot={snapshot} state={state} />);

    expect(html).toContain('data-immediate="0"');
    expect(html).toContain('data-prompt="0"');
    expect(html).not.toContain("look around");
    expect(html).not.toContain("why am I here?");
  });
});
