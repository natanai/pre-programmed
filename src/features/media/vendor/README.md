# Native pre-midi contract

This folder vendors the **current** dependency-free pre-midi musical document validator, format and Web Audio implementation from [pre-midi](https://github.com/natanai/pre-midi).

- Source of truth: pre-midi/schema.js and pre-midi/audio.js.
- These modules are mirrored verbatim for offline playback in pre-programmed's own Media feature.
- One v2 document: instruments, their reusable one-bar chunks, absolute timeline slots, and canonical note events.
- No v1 compatibility or conversion: the original format was never used in imported projects.
- Pre-programmed Media alone owns authored D1 mutations, import/export, preview, .ppgame round trips and event playback. Pre-midi alone owns full composition editing.
- Future incompatible changes should update these source files and TypeScript declaration mirrors in lockstep.
