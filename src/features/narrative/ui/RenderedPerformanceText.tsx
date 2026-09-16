import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TextCue, TextPerformance } from "../model";

function rangeContains(cue: TextCue, index: number) {
  return cue.start <= index && cue.end > index;
}

function cueNumber(cue: TextCue) {
  return typeof cue.value === "number" && Number.isFinite(cue.value) ? cue.value : null;
}

function innermostColorCue(cues: TextCue[], index: number) {
  return cues
    .filter((cue) => cue.type === "color" && rangeContains(cue, index) && typeof cue.value === "string")
    .sort((left, right) => right.start - left.start || (left.end - left.start) - (right.end - right.start))[0];
}

function opacityAt(cues: TextCue[], index: number) {
  const values = cues
    .filter((cue) => cue.type === "opacity" && rangeContains(cue, index))
    .map(cueNumber)
    .filter((value): value is number => value !== null);
  if (!values.length) return undefined;
  return values.reduce((result, value) => result * Math.max(0, Math.min(100, value)) / 100, 1);
}

function disappearAt(cues: TextCue[], index: number, presentedAt: number) {
  const deadlines = cues
    .filter((cue) => cue.type === "disappear" && rangeContains(cue, index))
    .map(cueNumber)
    .filter((value): value is number => value !== null)
    .map((seconds) => presentedAt + Math.max(0, seconds) * 1000);
  return deadlines.length ? Math.min(...deadlines) : undefined;
}

/**
 * Canonical player renderer for authored core text cues.
 * Delivery animation is optional for history, while appearance/timing cues remain durable.
 */
export function RenderedPerformanceText({
  text,
  performance,
  presentedAt,
  animateDelivery = true,
}: {
  text: string;
  performance: TextPerformance;
  presentedAt: number;
  animateDelivery?: boolean;
}) {
  const disappearDeadlines = useMemo(() => performance.cues
    .filter((cue) => cue.type === "disappear")
    .map(cueNumber)
    .filter((value): value is number => value !== null)
    .map((seconds) => presentedAt + Math.max(0, seconds) * 1000), [performance, presentedAt]);
  const [now, setNow] = useState(() => Date.now());
  const nextDeadline = disappearDeadlines
    .filter((deadline) => deadline > now)
    .sort((left, right) => left - right)[0];

  useEffect(() => {
    if (nextDeadline === undefined) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextDeadline - Date.now()) + 8);
    return () => window.clearTimeout(timeout);
  }, [nextDeadline]);

  const segments: Array<{ text: string; classes: string[]; style: CSSProperties; signature: string }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const classes = animateDelivery
      ? [...new Set(performance.cues
        .filter((cue) => ["wave", "shake", "blink"].includes(cue.type) && rangeContains(cue, index))
        .map((cue) => `cue-${cue.type}`))]
      : [];
    const colorCue = innermostColorCue(performance.cues, index);
    const opacity = opacityAt(performance.cues, index);
    const deadline = disappearAt(performance.cues, index, presentedAt);
    const hidden = deadline !== undefined && deadline <= now;
    const style: CSSProperties = {
      ...(colorCue && typeof colorCue.value === "string" ? { color: colorCue.value } : {}),
      ...(hidden ? { opacity: 0 } : opacity === undefined ? {} : { opacity }),
    };
    const signature = JSON.stringify([classes, style.color ?? null, style.opacity ?? null, deadline ?? null]);
    const previous = segments.at(-1);
    if (previous && previous.signature === signature) previous.text += text[index];
    else segments.push({ text: text[index], classes, style, signature });
  }

  return <>{segments.map((segment, index) => <span
    key={index}
    className={segment.classes.join(" ") || undefined}
    style={segment.style}
  >{segment.text}</span>)}</>;
}
