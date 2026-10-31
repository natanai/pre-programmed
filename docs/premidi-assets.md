# Repository-owned pre-midi assets

Music files belong to the engine's existing File Media system. Author Mode does not upload, import, embed, or copy `.premidi` files into game persistence.

## Discovery

- **Windows portable:** put `intro.premidi` in `assets/` beside the portable application's `_engine/` folder. The desktop host scans that directory at application launch. Restart after adding or replacing files.
- **Hosted website:** commit the file under `public/assets/` (including nested folders) and deploy. The ordinary build-time manifest scanner discovers it without an extra registration step.
- The scanner accepts `.premidi`, categorizes it as Audio File Media with MIME `audio/x-premidi`, and assigns the same `repo:/assets/<relative-path>` stable ID used for other file Media. Optional neighboring `.premidi.asset.json` receipts preserve identity across moves; a writable portable folder writes an ID receipt automatically.
- Files appear in Author Mode's **Media Assets → Music** filter, **Compositions**, and the **Audio Source** chooser. Game audio effects and inline `/audio` references store the stable asset ID, not audio bytes or the local path.
- Missing files are not silently reconstructed from project state. Existing legacy v2 composition objects remain accessible in older `.ppgame` saves without being migrated or deleted.

## Playback qualification

The isolated [prototype PR #244](https://github.com/natanai/pre-programmed/pull/244) can audition compatible synth-only Beat v7 and Song v8 files directly from their resolved repository URL, and still reads legacy v2 scores. This is **not full pre-midi engine parity**. Unsupported samples, advanced effects, harmonic/noise voices, modulated or automated formats, and vocal recordings return an explicit error instead of playing altered music.

The `.premidi` file contains score instructions, not a rendered WAV. A pre-midi package with external sample/recording assets needs its separate companions; this prototype does not yet decode or resolve those assets. No in-app file picker is needed or provided.

## Verification

`tests/premidiAssetDiscovery.test.ts` checks real directory scanning, stable ID/receipt generation, browser-visible manifest resolution, and appearance in the ordinary Audio catalog. The test is part of `npm run verify`. The isolated branch also passed `npm run verify:local` at [Actions run #41249037736](https://github.com/natanai/pre-programmed/actions/runs/41249037736). The normal deployment workflow was restored unchanged after qualification.
