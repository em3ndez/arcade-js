// SPDX-License-Identifier: GPL-3.0-only
// Per-frame update of the 8 object slots (SPRITE_SOURCE_OBJ_BASE, 32-byte stride): for each slot, drive
// its record through the object dispatcher, which reads the record's active/death-anim flags and state
// index and runs the matching object-AI handler. The dispatcher returns per slot, so the loop just walks
// the record base forward across the eight slots.
import { SPRITE_SOURCE_OBJ_BASE } from "./names.js";
import { driveObjectSlot } from "./driveObjectSlot.js";

const SLOT_COUNT = 8;
const SLOT_STRIDE = 0x20; // bytes per object record

export function driveAllObjectSlots(m) {
  let rec = SPRITE_SOURCE_OBJ_BASE;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    driveObjectSlot(m, rec); // drive one slot: dying-anim handoff / inactive skip / state handler
    rec += SLOT_STRIDE; // 8 object slots, well under the 16-bit wrap
  }
}
