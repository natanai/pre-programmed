import type { PlayState, ProjectSnapshot } from "../../../engine/project/model";
import { characterNameForPresentation } from "../playState";

/**
 * Live player speaker label, including in Author mode. Author mode only adds
 * the Edit affordance; it must never substitute a canonical Author-only name.
 * Persisted transcript lines retain their speakerName from when they appeared.
 */
export function SpeakerPrefix({ snapshot, state, speakerId, speakerName, onEdit }: {
  snapshot: ProjectSnapshot;
  state: PlayState;
  speakerId?: string | null;
  speakerName?: string;
  onEdit?: () => void;
}) {
  if (!speakerId) return null;
  const speaker = snapshot.entities.find((entity) => entity.type === "character" && entity.id === speakerId);
  if (!speaker) return null;
  const name = speakerName ?? characterNameForPresentation(speaker, state, false, snapshot);
  return onEdit
    ? <button type="button" className="story-speaker-edit" onClick={onEdit}>{name}: </button>
    : <span>{name}: </span>;
}
