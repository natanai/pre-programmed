# Semantic References and Player Commands

Pre-Programmed exposes cross-feature meaning through one engine-level semantic reference contract. `@` authoring, Player Command targets, project-reference analysis, and future consumers should ask this contract what an installed feature exposes instead of importing that feature's model/editor internals.

## Ownership rule

A semantic provider describes meaning; it does **not** become the owner of resources from another feature.

For every authorable candidate a provider exposes, the candidate carries the canonical Author resource identity that owns it. Static providers also declare the owning resource kind used for creation. Author consumers then call the shared resource/task broker:

- Edit opens the owning feature's real editor task.
- Create opens the owning feature's real creation task.
- The referencing parent remains suspended and mounted.
- Successful child creation returns the stable resource identity to the parent.
- The referencing surface never copies the owner's fields, validation, draft state, or mutation path.

This is the same `seen means editable` invariant used everywhere else in Author mode.

## Runtime context is derived, not duplicated

Contextual selectors represent facts about the current run without adding a second source of truth.

For example, `current-location` resolves as:

```text
PlayState.currentNodeId
  -> Narrative Node.locationId
  -> canonical World Location
```

There is no separate `currentLocationId` state field. When the selector currently resolves to a Location, Author mode edits that real Location. When the current Node has no Location, Author mode routes to the Node that owns the missing relationship rather than inventing a fake Current Location resource.

The same principle applies to other contextual selectors such as current Node, current speaker, and current body type.

## Stored references use stable identity

Friendly `@` names are discovery vocabulary only. Authored text stores a semantic token containing stable provider kind, candidate identity, projection, and optional format. Renaming a resource therefore does not orphan the reference.

Legacy State-only `{{variable:...}}` and `{{computed:...}}` interpolation is a one-way compatibility input. Snapshot normalization migrates it toward the semantic token form; runtime consumers use the shared semantic resolver.

## Provider responsibilities

A feature semantic provider may expose:

- static authored resources;
- contextual runtime selectors;
- readable projections for authored text;
- aliases/keys used for discovery and Player Command vocabulary;
- an optional generic operation target;
- an optional runtime target-candidate view narrower than the full authored candidate set;
- canonical Author identity for editability;
- canonical resource kind for creation.

A provider should expose only meaningful capabilities. The existence of an engine resource does not imply every consumer must treat it as plain text or as an operation target.

The installed-provider catalog is an explicit composition root. Adding a feature may require registering its provider there, but it must not require modifying `ValueMentionField`, the Player Command parser, or another feature's editor implementation.

## Player Commands consume semantic references

Commands owns project-wide player grammar and custom player vocabulary. It does not own Locations, Items, Characters, Variables, or other target definitions.

A command placeholder may accept zero or more semantic source kinds:

- zero kinds means free text;
- one kind means one semantic domain;
- several kinds means the same placeholder can resolve several feature-owned domains.

For target operations, the resolved semantic candidate supplies the generic operation target. Commands then delegates execution to the Operations contract and delegates target behavior authoring to the owning feature's canonical Author route.

The provider's full `candidates()` list remains the authored/discovery vocabulary. When a provider supplies `targetCandidates()`, Player Command target resolution uses that narrower run-state view instead. This lets the resource owner answer questions such as “which Characters are actually present now?” without copying presence rules into Commands or hiding absent resources from Author vocabulary management.

Contextual aliases such as `here` resolve through the same provider identity as `@current-location`; Commands does not maintain a separate concept of current location.

If more than one permitted candidate matches the same player wording, resolution is explicitly ambiguous. The engine must not choose a target by array order, ID order, or another hidden tie-breaker.

## Command actions

A Player Command action has one of three meanings:

1. **Respond with text** — authored project-wide response text and effects, executed with Player Command provenance and semantic interpolation.
2. **Application capability** — delegates to an installed player-facing application surface such as Inventory, Status, Save, or Load.
3. **Target operation** — resolves a semantic target and invokes an operation owned by that target's feature/runtime adapter.

These are shared runtime behaviors. Author mode adds editing around them but does not substitute Author-only player behavior.

## Player vocabulary is not resource ownership

`settings.commands.referenceSources` stores Commands-owned vocabulary preferences: whether a semantic source is recognized, whether owner-supplied names/keys/aliases are used, and extra player aliases. It does not duplicate the referenced resource itself.

The feature provider remains the source of candidate identity and meaning; the resource provider remains the source of Author edit/create routing.

## Project references and runtime references are distinct

The Author project-reference graph answers durable dependency questions such as “which authored definition points at this Location?” Semantic runtime resolution answers questions such as “which Location does `current-location` mean in this run?”

Stored static semantic tokens contribute durable project references. Contextual selectors do not pretend to be static dependencies because their concrete owner can change with play state.

## Portable/local builds

The semantic contract belongs to the shared engine/features layer and resolves from `ProjectSnapshot + PlayState`. It must not depend on Cloudflare, D1, hosted authentication, or production URLs.

The portable Windows build packages the same runtime and Author system with local platform/persistence adapters. A reference or Player Command that needs a hosted-only special case is therefore an architectural error. `npm run verify:local` is part of the acceptance checkpoint for changes to this foundation.

## Review invariants

Before merging a semantic-reference or Player Command change, verify:

1. Does the feature define its semantic meaning once?
2. Can generic consumers use it without importing feature internals?
3. If the candidate is authorable, can Edit reach exactly one canonical owner task?
4. If it is creatable, does Create use that same owner and return to the suspended parent?
5. Is contextual state derived from existing canonical state rather than duplicated?
6. Do Player Commands use the same semantic identity that `@` and other consumers use?
7. Does runtime target availability remain owned by the target feature rather than Commands?
8. Does ambiguous player wording fail explicitly rather than guess?
9. Can the feature replace its editor/runtime implementation without rewriting `@` or Commands?
10. Does the same contract work in hosted and portable/local builds?
11. Has the superseded compatibility implementation been removed rather than left as a second source of truth?
