import { useLayoutEffect, useRef, useState } from "react";
import type { Interaction } from "../model";
import "./playerChoiceSurface.css";

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
        const label = interaction.wording || interaction.aliases[0] || "untitled";
        if (!authorMode) return <button type="button" key={interaction.id} onClick={() => onChoose(interaction)}>{label}</button>;
        const notation = notationForChoice?.(interaction) ?? "[D]";
        return <div className="author-choice-row" key={interaction.id}>
          <button
            type="button"
            className={`author-choice-edit${notation === "[D]" ? " draft-input" : ""}`}
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
            onClick={() => onEdit?.(interaction)}
          >{notation}</button>
          <button type="button" className="author-choice-play" onClick={() => onChoose(interaction)}>{label}</button>
        </div>;
      })}
    </div>
    {hasMoreBelow ? <button type="button" className="choice-scroll-cue" aria-label="Show more choices" onClick={() => surfaceRef.current?.scrollBy({ top: Math.max(44, surfaceRef.current.clientHeight * .8), behavior: "auto" })}>↓</button> : null}
  </div>;
}
