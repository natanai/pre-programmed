# Author Synth Interaction Direction

Branch: `author-ux-integration-refactor`

## Product intent

The Author Synth is primarily for short retro computer/system sounds: chirps, bleeps, alerts, hits, rebirth/startup cues, and similar procedural effects. It is not intended to become a miniature general-purpose music workstation.

That does **not** mean advanced values should be deleted. Less-common controls should remain fully authorable through progressive disclosure instead of occupying the primary composition surface.

## Primary interaction hierarchy

The normal path should read roughly:

`SOUND PALETTE → WAVE → SHAPE → STEPS → PITCH`

Exact envelope values, per-step volume, multi-voice structure, and similar detail remain available without competing with this primary path.

## Current interaction direction

- The structured `synth-sound` workspace owns the `SynthSound` draft, dirty state, validation, persistence, resource-task completion, and Save/Delete lifecycle.
- `SynthSequencer` is a specialized direct-manipulation control only. It must not grow a second draft/baseline/save path.
- Sound palettes are editable starting recipes, not a second sound format. Current palette set: **BLIP, CHIRP, CONFIRM, CHIME, ALERT, ERROR, BOOT, ASCEND, ZAP, HIT**.
- Applying a palette immediately auditions it, then exposes the same ordinary Synth recipe for further editing.
- Waveform choice is a row of tactile **SQUARE / TRI / SAW / SINE / NOISE** buttons rather than a dropdown and auditions the selected step.
- Voice envelope has lightweight **TIGHT / PUNCH / SOFT / RING** shape buttons. These only set the existing Attack/Release values; no new persisted synthesis model is introduced.
- Exact Attack/Release values remain available under an `EXACT ENVELOPE` disclosure and inherit the shared Author numeric scrub/flick behavior.
- Steps are large pads, four per row on narrow/mobile layouts.
- Each step exposes ON/OFF directly so rhythm authoring does not require selecting the step first.
- Selecting a step opens one roomy step editor rather than repeating tiny note controls across every step.
- The note itself is the primary pitch control: drag **up** to raise the note and **down** to lower it. Pitch changes audition while scrubbing.
- `-12`, `-1`, `+1`, and `+12` remain visible precision/accessibility fallbacks. Keyboard arrows also work; Shift changes by an octave.
- Selected steps can be auditioned independently from the whole recipe.
- Per-step `volume` remains fully authorable but is **secondary**. The selected step shows a compact `VOLUME n%` disclosure; opening it reveals a full-width 0–100 touch rail plus `-5 / +5` controls. Do not return to tiny repeated sliders on every step.
- Tempo and Sequence Length remain numeric inputs and therefore inherit the shared Author mobile number scrub/flick gesture.

## UX rule

Prefer playful direct manipulation over repeated form controls, but every gesture must retain a visible/keyboard-accessible fallback. Keep less-common controls available through progressive disclosure rather than hiding/removing authored capability. Mobile and desktop operate on the same Synth resource and persistence path; only presentation/input affordances differ.

## Manual checks

- On iPhone-size width, confirm four step pads per row remain comfortably tappable.
- Apply each sound palette and confirm it immediately auditions and remains editable as ordinary Synth data.
- Switch waveform using the tactile waveform buttons and confirm the selected step auditions.
- Switch among TIGHT/PUNCH/SOFT/RING and confirm envelope character changes without requiring raw numbers.
- Open EXACT ENVELOPE and verify Attack/Release remain editable and support shared numeric drag/flick interaction.
- Toggle several steps ON/OFF directly from the pads without opening the detail editor each time.
- Select a pitched step and drag the large note surface upward/downward; confirm the note walks up/down the chromatic scale and auditions changes.
- Confirm `-12/-1/+1/+12` produce the same pitch mutations without gestures.
- Open VOLUME on a selected step and confirm the full-width rail is easy to control on mobile; verify `-5/+5` provide precise fallback adjustments.
- Confirm Noise hides pitch editing but retains step activation, volume, and audition behavior.
- Confirm Tempo/Sequence Length support shared numeric drag/flick interaction on coarse pointers.
- Save, leave, reopen, and verify the authored recipe is unchanged except for intended edits.
