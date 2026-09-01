# Engine 100% Acceptance Criteria

Current architecture/product estimate: **about 90% complete**.

This percentage measures the reusable engine + Author suite, not game content. It stays intentionally conservative: acceptance proof matters more than code volume.

## Remaining ~10%

### ~4% — finish core / feature and platform ownership

- Remove or migrate the remaining Narrative-specific `node` and `interaction` Author route payloads when they can use stable feature-owned identifiers without a compatibility registry.
- Finish moving the remaining hosted/platform choices out of shared application code where doing so creates a real replaceable boundary rather than abstraction for its own sake.
- App still directly owns a few hosted Author-session/backup/save selections even though project persistence and Author workspace/history/undo now have platform composition points.
- Keep shrink-only compatibility facades from gaining responsibilities.

Acceptance: optional feature implementations can still be replaced/deleted by changing the feature plus explicit composition entries, and hosted/local platform selection does not require feature or Author-editor rewrites.

### ~4% — prove a clean hosted installation

Run a literal fresh fork/clone through:

1. installation setup;
2. its own D1 creation;
3. first Worker deploy;
4. API/client configuration;
5. Author login;
6. save;
7. full reload with the edit still present.

Fix only concrete friction found by that acceptance run. The existing production D1 must never be reused for this proof.

### ~2% — real-machine / real-client acceptance and presentation polish

Local-machine architecture is now substantially proven. `npm run local` launches the same Worker, canonical D1 schema/migrations, Author API, and Vite client entirely locally. `npm run verify:local` has passed a full starter-project → Author login → real mutation → shutdown → restart → persisted-revision acceptance path on a clean Linux CI environment. Local shutdown was also corrected and re-proven without orphaned Wrangler/workerd processes.

Remaining acceptance:

- exercise the supported local path on ordinary user machines, particularly Windows and macOS, and fix only concrete portability friction;
- confirm an unsaved Author editor survives crossing the desktop/mobile responsive breakpoint on a real client;
- finish desktop hierarchy/spacing based on real use at wide resolutions;
- continue keyboard/focus/scroll fixes only when reproduced on real clients.

Acceptance: local operation requires no Cloudflare account or production D1, persists across complete restart, and desktop/mobile remain two presentations of one Author system with identical data meaning and save semantics.

## Local runtime now proven

The local distribution deliberately reuses the hosted implementation instead of creating a second engine:

- `wrangler.local.jsonc` supplies an explicitly local-only Worker/D1 configuration;
- `npm run local` starts the real Worker and client together;
- local D1 data persists under ignored `.wrangler/local-runtime` state;
- the same Worker schema migrations initialize the starter project;
- the same Author login, mutation, history, undo, validation, and project-store behavior run locally;
- no `remote: true` binding is used, so the local runtime is isolated from hosted/production D1;
- `npm run verify:local` uses disposable local state and proves close/reopen persistence without touching a developer's normal local save.

The browser IndexedDB snapshot remains a cache/offline queue; it is not promoted into a second canonical local project store.

## What 100% does not mean

100% does **not** mean every future game feature exists, `App.tsx` is tiny, every compatibility re-export is deleted, or every possible platform is supported. It means the reusable engine architecture and its two required distributions—hosted and local—have passed the acceptance tests above without source edits for ordinary game authoring.
