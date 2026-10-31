import { describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanAssetDirectory } from "../scripts/asset-manifest-lib.mjs";
import { project } from "./fixtures";
import { configuredAssetStore } from "../src/features/media/ui/assetStore";
import { isPremidiAsset, repositoryPremidiAssets } from "../src/features/media/ui/premidiRepository";
import { repositoryAssetManifest } from "../src/platform/assets/repositoryManifest";

describe("repository-owned .premidi discovery", () => {
  it("indexes .premidi at startup without an author upload, with a stable ID and MIME", async () => {
    const root = await mkdtemp(join(tmpdir(), "pre-programmed-music-"));
    try {
      await mkdir(join(root, "music"), { recursive: true });
      const filename = join(root, "music", "intro.premidi");
      const bytes = '{"format":"pre-midi","version":7,"title":"Intro"}';
      await writeFile(filename, bytes, "utf8");
      const entries = await scanAssetDirectory(root, {
        logicalPathPrefix: "assets",
        runtimePathPrefix: "/assets",
      });
      expect(entries).toHaveLength(1);
      const score = entries[0];
      expect(score.id).toBe("repo:/assets/music/intro.premidi");
      expect(score.type).toBe("audio");
      expect(score.mimeType).toBe("audio/x-premidi");
      expect(score.byteLength).toBe(Buffer.byteLength(bytes));
      expect(score.path).toBe("assets/music/intro.premidi");
      expect(score.runtimePath).toBe("/assets/music/intro.premidi");
      expect(JSON.parse(await readFile(filename + ".asset.json", "utf8"))).toEqual({ id: score.id });
      expect((await scanAssetDirectory(root, { logicalPathPrefix: "assets", runtimePathPrefix: "/assets" }))[0].id).toBe(score.id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exposes detected music in the normal Author asset catalog and Audio Source picker", () => {
    const discovered = {
      id: "repo:/assets/music/intro.premidi", name: "intro.premidi", path: "assets/music/intro.premidi",
      runtimePath: "/assets/music/intro.premidi", type: "audio", mimeType: "audio/x-premidi",
      byteLength: 77, hash: "abc", dimensions: null,
      defaultPresentation: "overlay", authoringMode: "file",
    };
    vi.stubGlobal("window", { __PRE_PROGRAMMED_PORTABLE_ASSETS__: [discovered] });
    try {
      const snapshot = project();
      const found = repositoryPremidiAssets(snapshot);
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(discovered.id);
      expect(found[0].contentSource).toBe("repository");
      expect(found[0].available).toBe(true);
      expect(isPremidiAsset(found[0])).toBe(true);
      expect(configuredAssetStore.list(snapshot, "audio").some(a => a.id === discovered.id)).toBe(true);
      expect(repositoryAssetManifest().some(a => a.id === discovered.id)).toBe(true);
      expect(snapshot.mediaAssets).toEqual([]);
      expect(snapshot.mediaCompositions).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not classify WAV as music and leaves legacy files independent", () => {
    expect(isPremidiAsset({ mimeType: "audio/wav" })).toBe(false);
    expect(isPremidiAsset({ mimeType: "audio/x-premidi" })).toBe(true);
  });
});
