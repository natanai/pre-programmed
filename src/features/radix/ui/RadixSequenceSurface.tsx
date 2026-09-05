import { useEffect, useRef, useState } from "react";
import type { AuthoredSourceIdentity } from "../../../engine/presentation/authoredSource";
import type { SynthSound } from "../../media/model";
import {
  createProceduralToneSession,
  unlockProceduralAudio,
  type ProceduralToneSession,
} from "../../media/ui/proceduralTone";
import {
  createSeededArray,
  frequencyForValue,
  radixSortEvents,
  resolveRadixSeed,
} from "../algorithm";
import type { RadixSequenceDefinition } from "../model";
import "./radixSequence.css";

export type RadixSequenceSurfaceProps = {
  sequence: RadixSequenceDefinition;
  synth?: SynthSound;
  runtimeSeed?: number;
  runKey: string;
  source?: AuthoredSourceIdentity;
  authorMode?: boolean;
  onComplete: () => void;
  onEditSequence?: () => void;
  onEditSource?: () => void;
};

export function RadixSequenceSurface({
  sequence,
  synth,
  runtimeSeed,
  runKey,
  source,
  authorMode = false,
  onComplete,
  onEditSequence,
  onEditSource,
}: RadixSequenceSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toneRef = useRef<ProceduralToneSession | null>(null);
  const [stats, setStats] = useState({ accesses: 0, digit: 0, complete: false });

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let holdTimer = 0;
    let resizeObserver: ResizeObserver | null = null;
    const seed = resolveRadixSeed(sequence, runtimeSeed);
    const values = createSeededArray(sequence.arraySize, seed);
    const { events } = radixSortEvents(values, sequence.radix);
    const working = [...values];
    let activeIndex = -1;
    let markers: number[] = [];
    let cursor = 0;
    let lastTime = performance.now();
    let budget = 0;
    let accesses = 0;
    let digit = 0;
    let toneCount = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ensureTone = async () => {
      if (!sequence.soundEnabled || toneRef.current || cancelled) return;
      toneRef.current = await createProceduralToneSession(synth, sequence.volume);
    };
    void ensureTone();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = sequence.backgroundColor;
      context.fillRect(0, 0, width, height);
      const barWidth = width / Math.max(1, working.length);
      const markerSet = new Set(markers);
      for (let index = 0; index < working.length; index += 1) {
        const value = working[index];
        const barHeight = Math.max(1, Math.round((value / working.length) * height));
        context.fillStyle = index === activeIndex
          ? sequence.accessColor
          : markerSet.has(index)
            ? sequence.markerColor
            : sequence.barColor;
        const left = Math.floor(index * barWidth);
        const right = Math.max(left + 1, Math.ceil((index + 1) * barWidth));
        context.fillRect(left, height - barHeight, right - left, barHeight);
      }
    };

    const applyEvent = (event: (typeof events)[number]) => {
      accesses = event.accesses;
      if (event.type === "access") {
        activeIndex = event.index;
        if (!reducedMotion && sequence.soundEnabled && toneCount++ % sequence.toneStride === 0) {
          toneRef.current?.tone(frequencyForValue(
            event.value,
            working.length,
            sequence.minFrequency,
            sequence.maxFrequency,
          ));
        }
      } else if (event.type === "write") {
        working[event.index] = event.value;
        activeIndex = event.index;
        if (!reducedMotion && sequence.soundEnabled && toneCount++ % sequence.toneStride === 0) {
          toneRef.current?.tone(frequencyForValue(
            event.value,
            working.length,
            sequence.minFrequency,
            sequence.maxFrequency,
          ));
        }
      } else if (event.type === "markers") {
        markers = event.indexes;
      } else if (event.type === "pass") {
        digit = event.digit + 1;
        activeIndex = -1;
      } else if (event.type === "complete") {
        activeIndex = -1;
        markers = [];
      }
    };

    const finish = () => {
      if (cancelled) return;
      toneRef.current?.stop();
      toneRef.current = null;
      setStats({ accesses, digit, complete: true });
      draw();
      holdTimer = window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, sequence.finishHoldMs);
    };

    const tick = (time: number) => {
      if (cancelled) return;
      const elapsed = Math.max(0, time - lastTime);
      lastTime = time;
      budget += elapsed;
      const delay = Math.max(0, sequence.delayMs);
      let changed = false;
      let processed = 0;
      const maxPerFrame = reducedMotion ? 4096 : 512;
      while (cursor < events.length && processed < maxPerFrame && (delay === 0 || budget >= delay)) {
        if (delay > 0) budget -= delay;
        const event = events[cursor++];
        applyEvent(event);
        changed = true;
        processed += 1;
        if (event.type === "complete") {
          setStats({ accesses, digit, complete: true });
          draw();
          finish();
          return;
        }
        if (reducedMotion && event.type !== "pass") continue;
      }
      if (changed) {
        setStats({ accesses, digit, complete: false });
        draw();
      }
      frame = window.requestAnimationFrame(tick);
    };

    draw();
    resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    frame = window.requestAnimationFrame(tick);

    const unlock = () => {
      void unlockProceduralAudio().then(ensureTone);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      toneRef.current?.stop();
      toneRef.current = null;
    };
  }, [onComplete, runKey, runtimeSeed, sequence, synth]);

  return <section
    className={`radix-sequence-surface radix-width-${sequence.widthMode}`}
    style={{
      "--radix-height": `${sequence.heightPx}px`,
      "--radix-bg": sequence.backgroundColor,
    } as React.CSSProperties}
    aria-label={sequence.label || "Radix sort presentation"}
    data-source-kind={source?.resourceKind}
    data-source-id={source?.resourceId}
  >
    <div className="radix-canvas-frame">
      <canvas ref={canvasRef} className="radix-canvas" />
      {sequence.showAlgorithmLabel || sequence.showStats ? <div className="radix-meta" aria-live="off">
        {sequence.showAlgorithmLabel ? <span>RADIX SORT (LSD) · BASE {sequence.radix}</span> : null}
        {sequence.showStats ? <span>{stats.accesses} ARRAY ACCESSES · PASS {stats.digit}{stats.complete ? " · COMPLETE" : ""}</span> : null}
      </div> : null}
    </div>
    {sequence.caption ? <div className="radix-caption">{sequence.caption}</div> : null}
    {authorMode && (onEditSequence || onEditSource) ? <div className="radix-author-actions">
      {onEditSequence ? <button type="button" onClick={(event) => { event.stopPropagation(); onEditSequence(); }}>[EDIT SEQUENCE]</button> : null}
      {onEditSource ? <button type="button" onClick={(event) => { event.stopPropagation(); onEditSource(); }}>[EDIT SOURCE]</button> : null}
    </div> : null}
  </section>;
}
