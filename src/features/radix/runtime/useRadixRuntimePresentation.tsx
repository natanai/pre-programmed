import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { AuthoredSourceIdentity } from "../../../engine/presentation/authoredSource";
import type { ProjectSnapshot } from "../../../engine/project/model";
import { RadixSequenceSurface } from "../ui/RadixSequenceSurface";

type ActiveRadixPresentation = {
  sequenceId: string;
  runKey: string;
  startup: boolean;
  source?: AuthoredSourceIdentity;
};

export type RadixRuntimePresentation = {
  active: boolean;
  startup: boolean;
  beginStartup(project: ProjectSnapshot): boolean;
  suppressStartup(): void;
  showSequence(sequenceId: string, source?: AuthoredSourceIdentity): void;
  surface: ReactNode;
};

/**
 * Feature-owned runtime controller for Radix presentations.
 *
 * App supplies only shell-level lifecycle hooks and a generic launch-blocking
 * ref. Radix owns sequence selection, active-run identity, reconciliation,
 * synth lookup, rendering, and completion semantics.
 */
export function useRadixRuntimePresentation({
  snapshot,
  launchBlockingRef,
  authorMode,
  onStartupBegin,
  onStartupComplete,
  onEditSequence,
  onEditSource,
  canEditSource,
}: {
  snapshot: ProjectSnapshot | null;
  launchBlockingRef: MutableRefObject<boolean>;
  authorMode: boolean;
  onStartupBegin: () => void;
  onStartupComplete: () => void;
  onEditSequence: (sequenceId: string) => void;
  onEditSource: (source: AuthoredSourceIdentity) => void;
  canEditSource: (source?: AuthoredSourceIdentity) => boolean;
}): RadixRuntimePresentation {
  const [activePresentation, setActivePresentation] = useState<ActiveRadixPresentation | null>(null);
  const activeRef = useRef<ActiveRadixPresentation | null>(null);
  const startupAttemptedRef = useRef(false);
  const startupBeginRef = useRef(onStartupBegin);
  const startupCompleteRef = useRef(onStartupComplete);
  startupBeginRef.current = onStartupBegin;
  startupCompleteRef.current = onStartupComplete;

  const setActive = useCallback((next: ActiveRadixPresentation | null) => {
    activeRef.current = next;
    setActivePresentation(next);
  }, []);

  const completeActive = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;
    setActive(null);
    if (!current.startup) return;
    launchBlockingRef.current = false;
    startupCompleteRef.current();
  }, [launchBlockingRef, setActive]);

  const beginStartup = useCallback((project: ProjectSnapshot) => {
    if (startupAttemptedRef.current) return launchBlockingRef.current;
    startupAttemptedRef.current = true;
    const startup = project.settings.radix.startup;
    const sequence = startup.enabled
      ? project.settings.radix.sequences.find((candidate) => candidate.id === startup.sequenceId)
      : undefined;
    if (!sequence) return false;
    launchBlockingRef.current = true;
    startupBeginRef.current();
    setActive({
      sequenceId: sequence.id,
      runKey: crypto.randomUUID(),
      startup: true,
    });
    return true;
  }, [launchBlockingRef, setActive]);

  const suppressStartup = useCallback(() => {
    startupAttemptedRef.current = true;
    launchBlockingRef.current = false;
    setActive(null);
  }, [launchBlockingRef, setActive]);

  const showSequence = useCallback((sequenceId: string, source?: AuthoredSourceIdentity) => {
    if (!snapshot || launchBlockingRef.current) return;
    if (!snapshot.settings.radix.sequences.some((sequence) => sequence.id === sequenceId)) return;
    setActive({
      sequenceId,
      runKey: crypto.randomUUID(),
      startup: false,
      source,
    });
  }, [launchBlockingRef, setActive, snapshot]);

  useEffect(() => {
    if (!snapshot || !activePresentation) return;
    if (snapshot.settings.radix.sequences.some((sequence) => sequence.id === activePresentation.sequenceId)) return;
    completeActive();
  }, [activePresentation, completeActive, snapshot]);

  const sequence = activePresentation && snapshot
    ? snapshot.settings.radix.sequences.find((candidate) => candidate.id === activePresentation.sequenceId)
    : undefined;
  const synth = sequence?.synthId && snapshot
    ? snapshot.synthSounds.find((sound) => sound.id === sequence.synthId)
    : undefined;

  const surface = activePresentation && sequence ? <RadixSequenceSurface
    sequence={sequence}
    synth={synth}
    runKey={activePresentation.runKey}
    source={activePresentation.source}
    authorMode={authorMode}
    onComplete={completeActive}
    onEditSequence={authorMode ? () => onEditSequence(sequence.id) : undefined}
    onEditSource={authorMode && canEditSource(activePresentation.source) && activePresentation.source
      ? () => onEditSource(activePresentation.source!)
      : undefined}
  /> : null;

  return {
    active: Boolean(activePresentation),
    startup: Boolean(activePresentation?.startup),
    beginStartup,
    suppressStartup,
    showSequence,
    surface,
  };
}
