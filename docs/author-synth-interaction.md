# Author Synth Interaction Direction

## Product intent

The Author Synth is primarily for short retro computer/system audio: chirps, bleeps, alerts, hits, rebirth/startup cues, and similar procedural effects. It is not intended to become a miniature general-purpose music workstation.

A **Synth** is a procedural authored definition stored with project data. An **audio file** is ordinary repository Media discovered from `public/assets/` (or the portable installation's `assets/` folder). These are separate authoring concepts even when a playback rule can accept either as an audio source.

The Synth should feel like a small tactile sound toy rather than a form. Less-common controls remain authorable through progressive disclosure without competing with the primary composition surface.

## Primary interaction hierarchy

The normal path should read roughly:

`PLAY / TEMPO → VOICE → WAVE → ATTACK / RELEASE → SEQUENCE`

The sequence itself is the instrument. Authors should not have to select a step, travel to another editor, and then manipulate the note they just touched.

## Current interaction direction

- The structured Synth workspace owns its draft, dirty state, validation, persistence, resource-task completion, and Save/Delete lifecycle. The legacy internal route/resource identifier `synth-sound` remains a compatibility boundary; it is not the product label.
- `SynthSequencer` is a specialized direct-manipulation control only. It must not grow a second draft/baseline/save path.
- The workbench transport keeps **PLAY, BPM, and LOOP** adjacent to the instrument. BPM retains ordinary numeric entry plus shared Author touch scrubbing and explicit `-5 / +5` adjustments.
- The transport is sticky within the Synth task so tempo remains reachable while editing long sequences on narrow/mobile layouts.
- Waveform choice is a tactile **SQUARE / TRI / SAW / SINE / NOISE** row rather than a dropdown.
- The old named Shape presets are not part of the primary authoring model. **Attack** and **Release** are direct full-width rails.
- Attack/Release rails use a non-linear mapping that gives short envelope times more physical travel, making tiny computer clicks/bleeps easier to tune than raw decimal entry.
- Sequence length lives with the sequence as direct `- / +` controls and still calls the one canonical sequence-resize operation for every voice.
- Steps are large pads, four per row in narrow panes and eight per row when the actual Author pane has enough width.
- Tapping a step toggles it on/off.
- On pitched voices, dragging a step **up/down** changes its chromatic note and auditions changes immediately.
- On pitched voices, dragging a step **left/right** adds a restrained per-step pitch sweep. Horizontal and vertical gestures use a dead zone and axis lock so slightly diagonal finger movement does not accidentally change both values.
- A pitch sweep is optional Synth recipe data expressed in semitones across one step. Existing Synths without it remain valid. The procedural oscillator scheduler owns playback of the sweep; the editor does not fake it.
- A small selected-step detail disclosure remains only for secondary controls such as per-step volume, audition, and clearing a sweep. Primary note manipulation never depends on opening it.
- Noise steps retain direct activation and volume/audition behavior but do not expose pitch gestures.
- Multi-voice add/duplicate/remove operations remain on the same Synth draft and use the existing voice helpers.

## Responsive ownership

- Mobile and desktop use exactly the same Synth resource, editor component, mutations, playback path, and Save semantics.
- Responsive behavior is based on the **actual Author pane width**, not the browser viewport. A narrow resizable desktop Author pane therefore receives the same compact presentation as a phone-sized pane.
- The workbench uses one column when narrow. With enough Author-pane width, patch controls and the sequence become a two-column workbench.
- The sequence keeps four columns in narrow panes and eight columns once there is enough local width.
- Interactive controls must remain comfortably reachable with coarse pointers and while the mobile keyboard is open.

## Audio-source boundary

- Synth authoring creates and edits Synth definitions only.
- Repository audio is authored as File Media and remains an `Audio File` in Author UI.
- A broad playback selector may offer both and should be labeled `Audio Source`, not `Sound`, so the two origins remain legible.
- Features consuming audio reference stable Media/Synth identities and must not care whether playback resolves a procedural Synth or a repository audio file.
- Do not create a second Synth editor or a second audio-file persistence path to make cross-feature selection convenient; nest the owning editor instead.

## UX rule

Prefer playful direct manipulation over repeated form controls, but every gesture must retain a visible/keyboard-accessible fallback. Keep less-common controls available through progressive disclosure rather than hiding/removing authored capability. Mobile and desktop operate on the same Synth resource and persistence path; only presentation/input affordances differ.

## Manual checks

- At a narrow Author-pane width, confirm the workbench stays single-column, step pads remain four per row, and no control creates horizontal page overflow.
- At a wider Author-pane width, confirm patch controls and sequence become a two-column workbench and steps become eight per row.
- Scroll a long Synth task and confirm PLAY/BPM/LOOP remain reachable without covering unrelated Author chrome.
- Change BPM by typing, shared touch scrubbing, and `-5 / +5`; verify all three edit the same tempo value.
- Adjust Attack and Release from very short values through longer tails; confirm short values have useful physical resolution.
- Add and remove beats with the sequence `- / +`; switch voices and confirm every voice stays the same sequence length.
- Toggle pitched beats by tapping them directly.
- Drag pitched beats vertically and confirm notes walk the chromatic scale, become active when manipulated, and audition each meaningful change.
- Drag pitched beats horizontally and confirm small left/right movements inside the dead zone do nothing, then clear horizontal movement locks to pitch sweep only.
- Confirm an upward sweep displays `↗n`, a downward sweep displays `↘n`, playback actually bends during the beat, and `CLEAR SWEEP` returns it to zero.
- Confirm slightly diagonal gestures commit to only one axis rather than mutating both note and sweep.
- Verify keyboard Up/Down adjusts note and Left/Right adjusts sweep on focused pitched pads.
- Open Step Details and confirm volume/audition remain available without becoming the primary pitch workflow.
- Confirm Noise uses direct step activation but no pitch/sweep gesture language.
- Add, duplicate, remove, and switch voices; verify edits remain on the same Synth draft.
- Save, leave, reopen, and verify notes, sweeps, envelope, sequence length, tempo, loop state, and volume persist unchanged.
- Reopen an older Synth created before pitch sweeps existed and confirm it plays and saves without migration.
- Add a repository audio file, rebuild, and confirm it appears as an Audio File rather than a Synth.
- Open an Audio Source selector and confirm procedural Synths and repository audio files are both selectable and visibly distinguished.