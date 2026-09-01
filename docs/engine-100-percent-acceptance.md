# Engine 100% Acceptance Criteria

Current architecture/product estimate: **about 86% complete**.

This percentage measures the reusable engine + Author suite, not game content. It stays intentionally conservative: acceptance proof matters more than code volume.

## Remaining ~14%

### ~4% — finish core / feature ownership

- Remove or migrate the remaining Narrative-specific `node` and `interaction` Author route payloads when they can use stable feature-owned identifiers without a compatibility registry.
- Finish moving hosted/platform choices out of shared application code where a real alternative adapter is ready.
- Keep shrink-only compatibility facades from gaining responsibilities.

Acceptance: optional feature implementations can still be replaced/deleted by changing the feature plus explicit composition entries, not unrelated core internals.

### ~4% — prove a clean hosted installation

Run a literal fresh fork/clone through:

1. installation setup;
2. its own D1 creation;
3. first Worker deploy;
4. API/client configuration;
5. Author login;
6. save;
7. full reload with the edit still present.

Fix only concrete friction found by that acceptance run.

### ~4% — deliver a true local-machine distribution

A machine with no Cloudflare account configured must be able to:

1. clone/download the engine;
2. start the supported local runtime;
3. load or initialize a project;
4. enter Author mode under a local trust/session model;
5. save an edit through the same mutation semantics;
6. completely close the app/process;
7. reopen it with the same project and edit intact.

Local mode must reuse the same project model, feature registry, Author editors, mutations, validation, and play state. Cloudflare is the hosted reference adapter, not the engine definition.

Before packaging, isolate the remaining hosted services behind platform boundaries: Author session/login, workspace/history/undo, backup, and project persistence selection. Choose the actual local storage technology only when that packaging work is ready to be implemented.

### ~2% — real-client Author acceptance and presentation polish

- Confirm an unsaved editor survives crossing the desktop/mobile responsive breakpoint.
- Finish desktop hierarchy/spacing based on real use at wide resolutions.
- Continue keyboard/focus/scroll fixes only when reproduced on real clients.

Acceptance: desktop and mobile remain two presentations of one Author system with identical data meaning and save semantics.

## What 100% does not mean

100% does **not** mean every future game feature exists, `App.tsx` is tiny, every compatibility re-export is deleted, or every possible platform is supported. It means the reusable engine architecture and its two required distributions—hosted and local—have passed the acceptance tests above without source edits for ordinary game authoring.
