// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, SAVED_INDEX, SAVED_INDEX2, TIMED_OBJECT_COUNT, SHAPE_COORD, SHAPE_ID, SHAPE_ACTIVE, SHAPE_ANIM } from "./names.js";

/**
 * insertTimedObject — seat a new object in the 8-slot timed-object table. ROM 0xa3d6.
 *
 * Role in the machine: Tempest tracks a small pool of short-lived objects (the animated shapes
 * spawned during play/attract) across four parallel per-slot arrays indexed 0..7 — a presence byte
 * loc_30a, a type byte loc_302, a lane byte loc_2fa, and an age/counter loc_312. This routine is the
 * allocator: it finds a home for a new object, preferring a free slot, and when the pool is full it
 * evicts the oldest occupant (the slot whose counter loc_312 is largest) so the newest request always
 * gets in. Callers stage the object's fields in the shared scratch cells before entering here.
 *
 * Behavior: first preserve the caller's X/Y into scratch (loc_2e/loc_2f) and zero the eviction search
 * accumulators loc_2a (running max counter) and loc_2b (its slot). Scan slots 7..0: the first empty one
 * (presence loc_30a,i == 0) wins immediately; along the way track the largest counter seen and the slot
 * that holds it. If no slot was empty, this is an eviction — drop the live count loc_116 by one (the
 * victim is about to be overwritten in place) and reuse loc_2b, the fullest slot. Then fill the chosen
 * slot's four fields: counter loc_312 = 0 (fresh), type loc_302 from the type scratch loc_2c, presence
 * loc_30a from loc_29, lane loc_2fa from loc_2d. Finally bump the live count loc_116 by one.
 *
 * Live-out: the four parallel arrays at the chosen slot (counter/type/presence/lane) and the live-object
 * count loc_116; scratch loc_2a/loc_2b/loc_2e/loc_2f are left with the search leftovers.
 *
 * Grounding: [seen].
 */
// Insert a new object into the 8-slot table: reuse the first empty slot found,
// or when none is free evict the slot holding the largest counter (and drop the
// live count by one). Fill the chosen slot's four parallel fields, bump the count.
export function insertTimedObject(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[SAVED_INDEX] = x;  // preserve the caller's index registers into scratch
  mem8[SAVED_INDEX2] = y;
  mem8[loc_2a] = 0;       // running max counter seen during the eviction scan
  mem8[loc_2b] = 0;       // slot that holds that max (the eviction candidate)
  let slot = -1;
  for (let i = 7; i >= 0; i--) {
    if (mem8[u16(SHAPE_ACTIVE + i)] === 0) { slot = i; break; } // first empty slot wins outright
    const age = mem8[u16(SHAPE_ANIM + i)];                      // this slot's counter loc_312
    if (age >= mem8[loc_2a]) {
      mem8[loc_2a] = age;  // remember the fullest-so-far slot for possible eviction
      mem8[loc_2b] = i;
    }
  }
  if (slot < 0) {
    // Pool full: evict the oldest. Its presence is overwritten in place, so the net count is unchanged;
    // decrementing here balances the unconditional bump below.
    mem8[TIMED_OBJECT_COUNT] = u8(mem8[TIMED_OBJECT_COUNT] - 1);
    slot = mem8[loc_2b];
  }
  mem8[u16(SHAPE_ANIM + slot)] = 0;                     // counter loc_312 = 0: fresh object
  mem8[u16(SHAPE_ID + slot)] = mem8[COORD_LIST_PTR_LO]; // type loc_302 from the type scratch loc_2c
  mem8[u16(SHAPE_ACTIVE + slot)] = mem8[loc_29];        // presence loc_30a from loc_29
  mem8[u16(SHAPE_COORD + slot)] = mem8[COORD_LIST_PTR_HI]; // lane loc_2fa from loc_2d
  mem8[TIMED_OBJECT_COUNT] = u8(mem8[TIMED_OBJECT_COUNT] + 1); // one more live object
}
