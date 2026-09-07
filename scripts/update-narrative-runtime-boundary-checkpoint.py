from pathlib import Path

path = Path("docs/author-ux-integration-refactor-plan.md")
text = path.read_text()

replacements = {
'''- [ ] Finish moving Narrative player presentation/execution semantics behind Narrative-owned runtime contracts.
  - [x] `useNarrativePlayerSurface` owns current node, anchor, graph notation, fallback interaction/notation, choice visibility, and immediate/menu choice derivation.
  - [x] `resolveNodeOpeningPresentation` and memoized `useNarrativeContinuation` own node/interaction prose interpolation, text-notation compilation, speaker resolution, authored source identity, and follow-up prose payloads while App retains timing/state setters.
  - [x] `executeInteraction` now returns the selected outcome's narration/dialogue performances, so App no longer reinterprets the outcome through `interactionOutcomeProse`.
  - [ ] Re-audit the remaining direct Narrative imports in App and decide whether `executeInteraction` itself should remain a composition-root call or move behind a higher-level player-runtime contribution.
''': '''- [x] Move Narrative player presentation/execution semantics behind Narrative-owned runtime contracts without hiding legitimate composition-root dispatch.
  - [x] `useNarrativePlayerSurface` owns current node, anchor, graph notation, fallback interaction/notation, choice visibility, and immediate/menu choice derivation.
  - [x] `resolveNodeOpeningPresentation` and memoized `useNarrativeContinuation` own node/interaction prose interpolation, text-notation compilation, speaker resolution, authored source identity, and follow-up prose payloads while App retains timing/state setters.
  - [x] `executeInteraction` returns the selected outcome's narration/dialogue performances, so App no longer reinterprets the outcome through `interactionOutcomeProse`.
  - [x] Interaction execution now returns the exact narration/dialogue presentation source while keeping effect-event provenance outcome-level; App no longer assigns Narrative prose sections itself.
  - [x] Re-audit concluded `executeInteraction(...)` is an appropriate composition-root call: App dispatches a parsed Interaction into its owning runtime but no longer contains the feature-specific interpretation around that call. Do not add an abstraction whose only purpose is hiding this import.
''',
'''- Media specialized-editor task-chrome cleanup and deletion of the superseded Synth list component.
''': '''- Media specialized-editor task-chrome cleanup and deletion of the superseded Synth list component;
- Interaction narration/dialogue provenance extraction from App into Narrative runtime, with effect provenance preserved separately.
''',
'''- ahead: **110 commits** before this checkpoint staging update
- behind: **0 commits**
- current pre-checkpoint source head: `7b3d87519df674450c06cc3a3fa76fd8ccb5e6ce` (`ux: remove duplicate media task chrome`).
- `App.tsx` diff versus main is now net smaller: 86 additions / 211 deletions as of the latest comparison, despite installing Radix and Narrative integration points.
''': '''- ahead: **116 commits** before this checkpoint staging update
- behind: **0 commits**
- current pre-checkpoint source head: `a43f6b2a18c5573820f0f1b63619c461c8b58931` (`refactor: keep interaction prose provenance in narrative runtime`).
- `App.tsx` remains net smaller than main: 87 additions / 219 deletions as of the latest comparison, despite installing Radix and Narrative integration points.
''',
'''- Expanded `InteractionExecution` with narration/dialogue performances and removed App's second interpretation of the selected outcome via `interactionOutcomeProse`.
- Every source and App-wiring slice above passed full `npm run verify` before/while committing.
''': '''- Expanded `InteractionExecution` with narration/dialogue performances and removed App's second interpretation of the selected outcome via `interactionOutcomeProse`.
- Moved the remaining Interaction prose-section provenance decision into Narrative runtime: displayed text gets narration/dialogue source identity there, while effect events retain their outcome-level source.
- Re-audited App and accepted direct `executeInteraction(...)` as the composition-root dispatch boundary; App no longer contains Narrative-specific interpretation around that call.
- Every source and App-wiring slice above passed full `npm run verify` before/while committing.
''',
'''5. re-audit remaining direct Narrative imports in App and decide whether the current `executeInteraction` composition-root call is an acceptable boundary before another runtime extraction;
6. do not begin the broader Session lifecycle move until the remaining lower-risk Author/runtime slices are stable; Session crosses saved-game compatibility and autosave semantics;
''': '''5. treat the Narrative runtime/App boundary as settled unless new feature-specific interpretation is added to App; `executeInteraction(...)` itself is an intentional composition-root dispatch call;
6. do not begin the broader Session lifecycle move until the remaining lower-risk Author/runtime slices are stable; Session crosses saved-game compatibility and autosave semantics;
''',
}

for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one plan fragment: {old[:100]!r}")
    text = text.replace(old, new)

path.write_text(text)
print("Narrative runtime boundary checkpoint updated")
