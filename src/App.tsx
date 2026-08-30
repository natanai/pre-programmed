import { useEffect, useMemo, useState } from "react";
import { OPENING_NODE, UNIVERSE_DRIVE_PROMPT } from "./game/opening";

function useTypewriter(text: string, charactersPerSecond: number) {
  const [count, setCount] = useState(0);
  const intervalMs = useMemo(
    () => Math.max(16, Math.round(1000 / Math.max(1, charactersPerSecond))),
    [charactersPerSecond],
  );

  useEffect(() => {
    setCount(0);
    if (!text) return;

    const interval = window.setInterval(() => {
      setCount((current) => {
        if (current >= text.length) {
          window.clearInterval(interval);
          return current;
        }
        return current + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [text, intervalMs]);

  return {
    visibleText: text.slice(0, count),
    complete: count >= text.length,
    completeImmediately: () => setCount(text.length),
  };
}

export default function App() {
  const { visibleText, complete, completeImmediately } = useTypewriter(
    OPENING_NODE.text,
    OPENING_NODE.performance.charactersPerSecond,
  );

  return (
    <main
      className="dos-screen"
      aria-label="Pre-Programmed terminal"
      onPointerDown={() => {
        if (!complete) completeImmediately();
      }}
    >
      <div className="dos-terminal" aria-live="polite">
        <div className="story-line">{visibleText}</div>
        {complete ? (
          <div className="prompt-line" aria-label={`${UNIVERSE_DRIVE_PROMPT} input cursor`}>
            <span>{UNIVERSE_DRIVE_PROMPT}</span>
            <span className="dos-cursor" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </main>
  );
}
