import { useState, type ReactNode } from "react";
import { unlockProceduralAudio } from "../features/media/ui/proceduralTone";
import "./universeBootstrap.css";

export function UniverseBootstrap({
  projectReady,
  startButtonText,
  children,
}: {
  projectReady: Promise<unknown>;
  startButtonText: string;
  children: ReactNode;
}) {
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [audioRetry, setAudioRetry] = useState(false);

  const initialize = async () => {
    if (initializing) return;
    setInitializing(true);
    setAudioRetry(false);

    const audioReady = await unlockProceduralAudio();
    if (!audioReady) {
      setInitializing(false);
      setAudioRetry(true);
      return;
    }

    try {
      await projectReady;
      setInitialized(true);
    } catch {
      setInitializing(false);
    }
  };

  if (initialized) return <>{children}</>;

  return <main className="universe-bootstrap" aria-label={startButtonText}>
    <button
      type="button"
      className="universe-bootstrap-action"
      disabled={initializing}
      onClick={() => void initialize()}
    >[{startButtonText}{initializing ? "..." : ""}]</button>
    {audioRetry ? <div className="universe-bootstrap-note" role="status">AUDIO START REQUIRES ANOTHER TAP.</div> : null}
  </main>;
}
