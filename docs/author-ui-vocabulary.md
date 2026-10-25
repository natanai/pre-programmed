# Author UI vocabulary

This is the author-facing naming contract. Feature implementations may use more
generic internal names; the interface must advertise only reachable resources
and tasks.

| Feature | Resource or task names authors should see | Do not advertise as a separate editor |
| --- | --- | --- |
| Structure | Node, Entry Response, Valid Input, Invalid Input Response, Response, Destination | Entry route, graph edge, generic authored interaction |
| State | Variable, Flag, Computed Value, Player Group, Player Status | World state, value group, State entity |
| People + Places | Character, Location | Speaker, world entity, person object |
| Inventory | Item, Body Type, Body Slot, Equipment Placement | Inventory behavior as a separate resource |
| Player Interactions | Player Command, Target Type, Target Names + Aliases | Target owner, command grammar |
| Media | Image, Audio File, Vector, Synth, Composition | Repository Media, generated D1 media |
| Presentation | Sort Sequence | Sort algorithm as a separate resource |
| Project | Advanced Settings, Run Navigation, History, Project File, Database Backup | Terminal grammar as an unrelated editor |

## Important relationships

- A Character can be used as a speaker. **Speaker** describes a use of a
  Character, not an additional World resource.
- Character aliases are alternate names for the same Character; their display
  conditions do not create additional Character records.
- Node-only Flags are scoped state, not project-level Flag definitions. They
  start false for each run and should be identified as **Node-only Flags**.
- Player Status is the player-facing presentation of assigned State values.
  It does not own duplicate Variable or Player Group editors.
- A Player Command can operate on existing targets. Those targets keep their
  respective owning editors.
- Repository files, generated vectors, Synths and Compositions have different
  storage mechanisms; storage names should be confined to advanced help rather
  than presented as additional authorable resource categories.

## Writing Author descriptions

Use the screen's actual choices. Prefer **Create and edit Characters and
Locations** over enumerating roles, implementation types, and related concepts.
Prefer **Open Player Commands** over **Edit command grammar** when the screen
uses Player Commands. A short, accurate label is more discoverable than a
long comprehensive-sounding label that promises nonexistent tools.

Most instructional copy belongs behind the shared `AuthorHelp` control beside
the relevant field. Visible content at rest should primarily communicate
authored content, current settings, validation failures, dangerous changes,
disabled reasons, and progress/results. Do not hide those operational facts in
helpers.
