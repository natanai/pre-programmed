# Author Synth Interaction Direction

Branch: `author-ux-integration-refactor`

## Product intent

The Author Synth is primarily for short retro computer/system sounds: chirps, bleeps, alerts, hits, rebirth/startup cues, and similar procedural effects. It is not intended to become a miniature general-purpose music workstation.

## Current interaction direction

- The structured `synth-sound` workspace owns the `SynthSound` draft, dirty state, validation, persistence, resource-task completion, and Save/Delete lifecycle.
- `SynthSequencer` is a specialized direct-manipulation control only. It must not grow a second draft/baseline/save path.
- Steps are large pads, four per row on narrow/mobile layouts.
- Each step exposes ON/OFF directly so rhythm authoring does not require selecting the step first.
- Selecting a step opens one roomy step editor rather than repeating tiny note controls across every step.
- The note itself is the primary pitch control: drag **up** to raise the note and **down** to lower it. Pitch changes audition while scrubbing.
- `-12`, `-1`, `+1`, and `+12` remain visible precision/accessibility fallbacks. Keyboard arrows also work; Shift changes by an octave.
- Waveform choice is a row of tactile buttons rather than a dropdown and auditions the selected step.
- Selected steps can be auditioned independently from the whole recipe.
- Per-step `volume` remains in `SynthStep` data for compatibility with existing presets/saved projects/runtime playback, but is intentionally **not exposed in normal Author UI**. Do not reintroduce per-step volume controls unless the product intent changes.
- Attack, Release, Tempo, and Sequence Length remain numeric inputs and therefore inherit the shared Author mobile number scrub/flick gesture.

## UX rule

Prefer playful direct manipulation over repeated form controls, but every gesture must retain a visible/keyboard-accessible fallback. Mobile and desktop operate on the same Synth resource and persistence path; only presentation/input affordances differ.

## Manual checks

- On iPhone-size width, confirm four step pads per row remain comfortably tappable.
- Toggle several steps ON/OFF directly from the pads without opening the detail editor each time.
- Select a pitched step and drag the large note surface upward/downward; confirm the note walks up/down the chromatic scale and auditions changes.
- Confirm `-12/-1/+1/+12` produce the same pitch mutations without gestures.
- Switch waveform using the tactile waveform buttons and confirm the selected step auditions.
- Confirm Noise hides pitch editing.
- Confirm Attack/Release/Tempo/Sequence Length support shared numeric drag/flick interaction on coarse pointers.
- Save, leave, reopen, and verify the authored recipe is unchanged except for intended edits.
