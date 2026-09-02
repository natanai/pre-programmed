# Equipment placements

Inventory equipment is modeled as authored **placements**, not item classes or hard-wired combinations.

An equipment placement has:

- an **anchor slot**: the body slot the player chooses when equipping;
- **occupied slots**: the complete set of body slots reserved while that placement is equipped, including the anchor.

An item with no explicit placements may anchor in any body slot and occupies only the chosen slot. Explicit placements are used when an item has restricted or multi-slot fits.

For example, a two-handed item can define two symmetric placements:

- anchor `left_hand`, occupy `left_hand` + `right_hand`;
- anchor `right_hand`, occupy `left_hand` + `right_hand`.

The runtime does not know what “two-handed,” “helmet,” “armor,” or other equipment categories mean. It only resolves placements against the active body type. This keeps the Inventory feature extensible to arbitrary authored bodies and equipment.

## Runtime rules

Equipping is transactional across the placement's entire occupied-slot set. Every conflicting equipped instance is displaced together. If any displaced slot-only item cannot safely return to general inventory, the equip attempt is refused without partially changing equipment.

A placement is available only when every slot it occupies exists on the active body type. Body-type changes reconcile the same placement model rather than using separate body-switch rules.

Starting equipment also uses the same placement resolver, so two starting items cannot silently overlap through secondary occupied slots.

## Author flow

Item equipment authoring uses the shared nested Author task runtime:

`Item → Equipment → Placement`

Equipment and Placement subtasks stage their results back into the suspended Item draft. They do not independently publish project mutations. Saving the Item remains the single persistence boundary.

The same tasks, data, and save semantics are used at every viewport size. Responsive presentation is handled by the shared Author renderer and Inventory-owned container-query styles; mobile does not have a separate equipment feature implementation.

## Persistence migration

Schema migration 22 converts the prior `equipment_slot_keys_json` compatibility list into equivalent one-slot placements. Thus an old item allowed in `left_hand` or `right_hand` becomes two explicit single-slot placements. New multi-slot behavior is then authored by adding additional occupied slots to those placements.
