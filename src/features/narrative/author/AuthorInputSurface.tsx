import { useLayoutEffect, useRef, useState } from "react";
import type { Interaction } from "../model";
import "./authorInputSurface.css";

export function AuthorInputSurface({
  choices,
  onChoose,
  notationForChoice,
  onEdit,
}: {
  choices: Interaction[];
  onChoose: (interaction: Interaction) => void;
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

  return <div className="author-input-scroll">
    <div ref={surfaceRef} className="author-input-surface" aria-label="Current authored inputs" onScroll={measure}>
      {choices.map((interaction) => {
        const label = interaction.wording || interaction.aliases[0] || "untitled";
        const notation = notationForChoice?.(interaction) ?? "[D]";
        return <div className="author-input-row" key={interaction.id}>
          <button
            type="button"
            className={`author-input-edit${notation === "[D]" ? " draft-input" : ""}`}
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
            onClick={() => onEdit?.(interaction)}
          >{notation}</button>
          <button type="button" className="author-input-play" onClick={() => onChoose(interaction)}>{label}</button>
        </div>;
      })}
    </div>
    {hasMoreBelow ? <button
      type="button"
      className="author-input-scroll-cue"
      aria-label="Show more authored inputs"
      onClick={() => surfaceRef.current?.scrollBy({
        top: Math.max(44, surfaceRef.current.clientHeight * .8),
        behavior: "auto",
      })}
    >↓</button> : null}
  </div>;
}
