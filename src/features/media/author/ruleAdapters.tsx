import type { EffectAuthorAdapter } from "../../../author/rules/types";
import { DefinitionSelect } from "../../../author/rules/controls";
import { ValueMentionField } from "../../../author/ValueMentionField";
import { ASSET_MANIFEST } from "../../../generated/assetManifest";

function AssetEffectSelect({ kind, value, onChange }: { kind: "audio" | "art"; value: string; onChange: (value: string) => void }) {
  const manifestType = kind === "art" ? "image" : "audio";
  const assets = ASSET_MANIFEST.filter((asset) => asset.type === manifestType && asset.runtimePath);
  const detected = assets.some((asset) => asset.runtimePath === value);
  const noun = kind === "art" ? "image / sprite" : "audio file";
  return <div className="asset-effect-picker">
    <select aria-label={`Choose detected ${noun}`} value={detected ? value : ""} onChange={(event) => onChange(event.target.value)}>
      <option value="">{assets.length ? `choose detected ${noun}` : `no detected ${noun}s`}</option>
      {assets.map((asset) => <option value={asset.runtimePath} key={asset.path}>{asset.path.replace(/^public\/assets\//, "")}</option>)}
    </select>
    {!assets.length ? <small>Put files in public/assets/ and deploy them; detected files will appear here.</small> : null}
    <details className="asset-manual-path"><summary>[MANUAL PATH]</summary>
      <input aria-label={`Manual ${noun} path`} placeholder="/assets/..." value={value} onChange={(event) => onChange(event.target.value)} />
    </details>
  </div>;
}

export const notificationEffectAdapter: EffectAuthorAdapter = {
  type: "notification",
  label: "floating notification",
  create: () => ({ id: crypto.randomUUID(), type: "notification", text: "" }),
  render: ({ effect, onChange, snapshot }) => effect.type === "notification"
    ? <div className="effect-notification"><ValueMentionField snapshot={snapshot} value={effect.text} onValueChange={(text) => onChange({ ...effect, text })} placeholder="notification text" /></div>
    : null,
};

export const synthEffectAdapter: EffectAuthorAdapter = {
  type: "synth",
  label: "play synth",
  create: () => ({ id: crypto.randomUUID(), type: "synth", synthId: "" }),
  render: ({ effect, onChange, snapshot }) => effect.type === "synth"
    ? <DefinitionSelect value={effect.synthId} definitions={snapshot.synthSounds} valueMode="id" onChange={(synthId) => onChange({ ...effect, synthId })} />
    : null,
};

export const audioEffectAdapter: EffectAuthorAdapter = {
  type: "audio",
  label: "play repo audio",
  create: () => ({ id: crypto.randomUUID(), type: "audio", assetPath: "" }),
  render: ({ effect, onChange }) => effect.type === "audio"
    ? <AssetEffectSelect kind="audio" value={effect.assetPath} onChange={(assetPath) => onChange({ ...effect, assetPath })} />
    : null,
};

export const artEffectAdapter: EffectAuthorAdapter = {
  type: "art",
  label: "show sprite/art",
  create: () => ({ id: crypto.randomUUID(), type: "art", assetPath: "" }),
  render: ({ effect, onChange }) => effect.type === "art"
    ? <AssetEffectSelect kind="art" value={effect.assetPath} onChange={(assetPath) => onChange({ ...effect, assetPath })} />
    : null,
};
