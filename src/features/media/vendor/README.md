# pre-midi native composition boundary

This folder vendors the dependency-free v1 pre-midi schema and playback modules from https://github.com/natanai/pre-midi.

- Source of truth for the portable document is pre-midi/schema.js.
- These exact JavaScript modules are vendored because the portable pre-programmed desktop build must function without network/package-registry access.
- The neighboring .d.ts files provide TypeScript declarations; pre-programmed never owns a parallel music production editor.
- The native Media feature owns D1 storage, import/export and the Author resource task; playback is reused from pre-midi.
- When updating pre-midi schema, synchronize the vendored files and add a v1 round-trip assertion. Incompatible schema changes require a new version and a migration, not silent conversion.

The original code was authored in the pre-midi repository; no third-party dependencies are introduced.
