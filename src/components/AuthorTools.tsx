import { useEffect, useMemo, useState } from "react";
import { fetchAuthorWorkspace, undoLastRevision } from "../data/api";
import type {
  AuthorBookmark,
  MutationOperation,
  PlayState,
  ProjectSnapshot,
  RevisionSummary,
  SynthSound,
} from "../game/model";
import { createSilentSynth, playSynthSound } from "../game/synth";
import { ASSET_MANIFEST } from "../generated/assetManifest";

export function AssetExplorer({ snapshot, onClose: _onClose }: { snapshot: ProjectSnapshot; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const assets = ASSET_MANIFEST.filter((asset) => asset.path.toLowerCase().includes(query.toLowerCase()));
  const referenced = new Set([
    ...snapshot.items.map((item) => item.assetPath).filter(Boolean),
    ...snapshot.interactions.flatMap((interaction) => interaction.outcomes.flatMap((outcome) => outcome.effects.flatMap((effect) => effect.type === "audio" || effect.type === "art" ? [effect.assetPath] : []))),
  ]);
  const runtimePaths = new Set(ASSET_MANIFEST.map((asset) => asset.runtimePath).filter(Boolean));
  const missing = [...referenced].filter((path) => !runtimePaths.has(path));
  return <section className="author-panel author-panel-frame asset-explorer" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>REPOSITORY ASSETS</span></header>
    <div className="author-panel-body">
      <input aria-label="Search repository assets" placeholder="local asset search" value={query} onChange={(event) => setQuery(event.target.value)} />
      {missing.length ? <div className="asset-warning"><strong>MISSING LINKED PATHS</strong>{missing.map((path) => <span key={path}>{path}</span>)}</div> : null}
      <div className="asset-list">{assets.map((asset) => <div key={asset.path}><span>{asset.path}</span><span>{asset.type} · {asset.size}b {asset.dimensions ? `· ${asset.dimensions.width}×${asset.dimensions.height}${asset.dimensions.width <= 32 && asset.dimensions.height <= 32 ? " SPRITE" : " ART"}` : ""}</span><code>{asset.hash.slice(0, 12)}</code></div>)}</div>
      {!assets.length ? <span>No manifest matches.</span> : null}
    </div>
  </section>;
}

export function SynthPanel({ snapshot, onSave, onClose: _onClose }: {
  snapshot: ProjectSnapshot;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SynthSound | null>(null);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const save = async () => {
    if (!draft?.key || !draft.label) return;
    await onSave([{ type: "synth.upsert", sound: draft }], `Changed synth ${draft.label}`);
  };
  return <section className="author-panel author-panel-frame synth-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>TINY SYNTH</span></header>
    <div className="author-panel-body">
      <div className="definition-list">{snapshot.synthSounds.map((sound) => <button type="button" key={sound.id} onClick={() => setDraft(structuredClone(sound))}><span>{sound.label}</span><span>{sound.key}</span></button>)}</div>
      <button type="button" onClick={() => setDraft(createSilentSynth())}>[+ SOUND]</button>
      {draft ? <div className="synth-editor">
        <label>KEY <input value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") })} /></label>
        <label>LABEL <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
        <label>TEMPO <input type="number" min={30} max={300} value={draft.tempo} onChange={(event) => setDraft({ ...draft, tempo: Number(event.target.value) })} /></label>
        <label className="check-label"><input type="checkbox" checked={draft.loop} onChange={(event) => setDraft({ ...draft, loop: event.target.checked })} /> loop recipe</label>
        <nav className="voice-tabs">{draft.voices.map((voice, index) => <button type="button" aria-pressed={voiceIndex === index} key={index} onClick={() => setVoiceIndex(index)}>[V{index + 1} {voice.waveform}]</button>)}</nav>
        {draft.voices[voiceIndex] ? <VoiceEditor sound={draft} voiceIndex={voiceIndex} onChange={setDraft} /> : null}
      </div> : null}
    </div>
    {draft ? <div className="author-panel-footer author-actions"><button type="button" onClick={() => void playSynthSound(draft)}>[PLAY]</button><button type="button" onClick={() => void save()}>[SAVE]</button><button type="button" onClick={() => setDraft(null)}>[CANCEL]</button></div> : null}
  </section>;
}

function VoiceEditor({ sound, voiceIndex, onChange }: { sound: SynthSound; voiceIndex: number; onChange: (sound: SynthSound) => void }) {
  const voice = sound.voices[voiceIndex];
  const updateVoice = (next: typeof voice) => onChange({ ...sound, voices: sound.voices.map((item, index) => index === voiceIndex ? next : item) });
  return <div className="voice-editor">
    <div className="voice-settings"><label>WAVE <select value={voice.waveform} onChange={(event) => updateVoice({ ...voice, waveform: event.target.value as typeof voice.waveform })}><option value="square">square</option><option value="triangle">triangle</option><option value="sawtooth">saw</option><option value="sine">sine</option><option value="noise">noise</option></select></label><label>ATTACK <input type="number" step="0.01" min={0} max={1} value={voice.attack} onChange={(event) => updateVoice({ ...voice, attack: Number(event.target.value) })} /></label><label>RELEASE <input type="number" step="0.01" min={0} max={1} value={voice.release} onChange={(event) => updateVoice({ ...voice, release: Number(event.target.value) })} /></label></div>
    <div className="synth-steps">{voice.steps.map((step, index) => <div className={step.active ? "active" : ""} key={index}><button type="button" aria-label={`Toggle step ${index + 1}`} onClick={() => updateVoice({ ...voice, steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, active: !item.active } : item) })}>{String(index + 1).padStart(2, "0")}</button>{voice.waveform !== "noise" ? <select aria-label={`Step ${index + 1} note`} value={step.note} onChange={(event) => updateVoice({ ...voice, steps: voice.steps.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item) })}>{[2,3,4,5,6,7].flatMap((octave) => ["C","D","E","F","G","A","B"].map((note) => <option key={`${note}${octave}`} value={`${note}${octave}`}>{note}{octave}</option>))}</select> : null}</div>)}</div>
  </div>;
}

export function WorkspacePanel({ token, snapshot, playState, onSave, onSnapshot, onRestore, onClose: _onClose }: {
  token: string;
  snapshot: ProjectSnapshot;
  playState: PlayState;
  onSave: (operations: MutationOperation[], description: string) => Promise<void>;
  onSnapshot: (snapshot: ProjectSnapshot) => void;
  onRestore: (bookmark: AuthorBookmark) => void;
  onClose: () => void;
}) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [bookmarks, setBookmarks] = useState<AuthorBookmark[]>([]);
  const [note, setNote] = useState("");
  const refresh = () => void fetchAuthorWorkspace(token).then((workspace) => { setRevisions(workspace.revisions); setBookmarks(workspace.bookmarks); });
  useEffect(refresh, [token, snapshot.revision]);
  const createBookmark = async () => {
    const bookmark: AuthorBookmark = { id: crypto.randomUUID(), nodeId: playState.currentNodeId, traversal: playState.traversal, playState, note, createdAt: new Date().toISOString() };
    await onSave([{ type: "bookmark.upsert", bookmark }], `Created author bookmark${note ? `: ${note}` : ""}`);
    setNote("");
  };
  return <section className="author-panel author-panel-frame workspace-panel" onPointerDown={(event) => event.stopPropagation()}>
    <header><span>HISTORY / LOCATIONS</span></header>
    <div className="author-panel-body">
      <div className="bookmark-create"><input placeholder="optional bookmark note" value={note} onChange={(event) => setNote(event.target.value)} /><button type="button" onClick={() => void createBookmark()}>[BOOKMARK HERE]</button></div>
      <h3>LOCATIONS</h3><div className="workspace-list">{bookmarks.map((bookmark) => <div key={bookmark.id}><span>#{snapshot.nodes.find((node) => node.id === bookmark.nodeId)?.nodeNumber} {bookmark.note || "untitled location"}</span><button type="button" onClick={() => onRestore(bookmark)}>[RESTORE]</button></div>)}</div>
      <h3>REVISIONS</h3><div className="workspace-list revisions">{revisions.map((revision) => <div key={revision.revision}><span>R{revision.revision} {revision.description}</span><small>{new Date(revision.createdAt).toLocaleString()}</small></div>)}</div>
      <button type="button" onClick={() => void undoLastRevision(token, snapshot.revision).then((result) => onSnapshot(result.snapshot))}>[UNDO LAST CHANGE]</button>
    </div>
  </section>;
}
