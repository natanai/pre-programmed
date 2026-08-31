import { useLayoutEffect, useRef, useState } from "react";
import type { Interaction } from "../model";
import "./playerChoiceSurface.css";

function playableInputValue(interaction: Interaction) {
  return interaction.aliases[0] || interaction.wording;
}

function insertIntoTerminal(value: string) {
  const input = document.querySelector<HTMLInputElement>(".prompt-input-row .terminal-input:not([type='password'])");
  if (!input) return false;

  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (valueSetter) valueSetter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  window.requestAnimationFrame(() => {
    input.focus({ preventScroll: true });
    input.setSelectionRange(value.length, value.length);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  });
  return true;
}

export function PlayerChoiceSurface({
  choices,
  onChoose,
  authorMode = false,
  notationForChoice,
  onEdit,
}: {
  choices: Interaction[];
  onChoose: (interaction: Interaction) => void;
  authorMode?: boolean;
  notationForChoice?: (interaction: Interaction) => string;
  onEdit?: (interaction: Interaction) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const choiceKey = choices.map((choice) => choice.id).join(":");
  const measure = () => {
    const surface = surfaceRef.current;
    if (!surface) return;
    setHasMoreBelow(surface.scrollTop + surface.clientHeight < surface.scrollHeight - 2);
  };

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [choiceKey]);

  return <div className={`player-choice-scroll${authorMode ? " author-choice-scroll" : ""}`}>
    <div ref={surfaceRef} className="player-choice-surface" aria-label={authorMode ? "Current valid inputs" : "Available choices"} onScroll={measure}>
      {choices.map((interaction) => {
        const authorLabel = interaction.wording || interaction.aliases[0] || "untitled";
        const playerLabel = playableInputValue(interaction) || "untitled";
        if (!authorMode) return <button type="button" key={interaction.id} onClick={() => {
          if (!insertIntoTerminal(playerLabel)) onChoose(interaction);
        }}>{playerLabel}</button>;
        const notation = notationForChoice?.(interaction) ?? "[D]";
        return <div className="author-choice-row" key={interaction.id}>
          <button
            type="button"
            className={`author-choice-edit${notation === "[D]" ? " draft-input" : ""}`}
            aria-label={`Edit ${authorLabel}`}
            title={`Edit ${authorLabel}`}
            onClick={() => onEdit?.(interaction)}
          >{notation}</button>
          <button type="button" className="author-choice-play" onClick={() => onChoose(interaction)}>{authorLabel}</button>
        </div>;
      })}
    </div>
    {hasMoreBelow ? <button type="button" className="choice-scroll-cue" aria-label="Show more choices" onClick={() => surfaceRef.current?.scrollBy({ top: Math.max(44, surfaceRef.current.clientHeight * .8), behavior: "auto" })}>↓</button> : null}
  </div>;
}
