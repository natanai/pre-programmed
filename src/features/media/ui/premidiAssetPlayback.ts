import type { MediaAssetDescriptor } from "../assets";
import { isPremidiAsset } from "./premidiRepository";

export type RepositoryMusicSession = { stop: () => void; finished?: Promise<void> };
export type RepositoryMusicResult = { session: RepositoryMusicSession; title: string; version: number; kind: string };

/** The asset manifest owns the ID and URL. Neither bytes nor decoded sound are
 * ever written to game persistence. Playback is explicitly limited to the
 * formats currently implemented by the preview engine.
 */
export async function playRepositoryPremidi(asset: MediaAssetDescriptor): Promise<RepositoryMusicResult> {
  if (!isPremidiAsset(asset) || !asset.available || !asset.url)
    throw Error("This repository music file is missing.");
  if (asset.byteLength > 8_000_000)
    throw Error("The .premidi instructions exceed the 8 MB reader limit.");
  const response = await fetch(asset.url, { cache: "no-store" });
  if (!response.ok) throw Error("Cannot read repository music file (" + response.status + ").");
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > 8_000_000)
    throw Error("The .premidi instructions exceed the 8 MB reader limit.");
  let header: { version?: unknown; kind?: unknown };
  try { header = JSON.parse(raw) as { version?: unknown; kind?: unknown }; }
  catch { throw Error("The repository .premidi is not valid JSON."); }

  if (header.version === 2 && header.kind === undefined) {
    const [{ parse }, { play }] = await Promise.all([
      import("../vendor/premidi-schema.js"),
      import("../vendor/premidi-audio.js"),
    ]);
    const doc = parse(raw);
    const session = await play(doc);
    return { session, title: doc.title, version: 2, kind: "legacy Beat" };
  }

  const { parseModernPremidi } = await import("../modernPremidiPlan");
  const plan = parseModernPremidi(raw);
  const { playModernPremidi } = await import("./modernPremidiPlayback");
  const session = await playModernPremidi(plan);
  return { session, title: plan.title, version: plan.version, kind: plan.kind };
}
