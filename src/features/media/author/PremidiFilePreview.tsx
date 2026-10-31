import { useEffect, useState } from "react";
import type { MediaAssetDescriptor } from "../assets";
import { unlockProceduralAudio } from "../ui/proceduralTone";
import { playRepositoryPremidi, type RepositoryMusicSession } from "../ui/premidiAssetPlayback";

export function PremidiFilePreview({ asset }: { asset: MediaAssetDescriptor }) {
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<RepositoryMusicSession | null>(null);

  useEffect(() => () => session?.stop(), [session]);
  const stop = () => { session?.stop(); setSession(null); setPlaying(false); };
  const play = async () => {
    // Unlock Media's existing AudioContext from the actual author gesture.
    const ready = unlockProceduralAudio();
    setBusy(true);
    stop();
    try {
      if (!(await ready)) throw Error("Audio output is unavailable.");
      const result = await playRepositoryPremidi(asset);
      setSession(result.session);
      setPlaying(true);
      setMessage(result.title + " · " + result.kind + " v" + result.version);
      if (result.session.finished) void result.session.finished.then(() => {
        setPlaying(false);
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This file cannot be played.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="media-premidi-file-preview">
    <button type="button" disabled={busy} onClick={() => { void play(); }}>[PLAY]</button>
    <button type="button" disabled={!playing} onClick={stop}>[STOP]</button>
    <span role="status">{message || "Music instructions from repository assets"}</span>
  </div>;
}
