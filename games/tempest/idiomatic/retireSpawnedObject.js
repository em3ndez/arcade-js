// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, COORD_LIST_PTR_HI, ACTIVE_ENEMY_COUNT, loc_2db, loc_2b5, HIT_TALLY } from "./names.js";
import { gateSound1f } from "./gateSound1f.js";
import { insertTimedObjectOfType } from "./insertTimedObjectOfType.js";

/**
 * retireSpawnedObject -- remove a live tube object (shot/enemy) from slot Y. ROM 0xa36f.
 *
 * Role in the machine: this is the near-rim kill path invoked by resolveSlotProximityInteractions when a
 * shot and an enemy coincide close to the player. It plays the destruction sound, unwinds the object's
 * drawing state, empties the slot, updates the live-object count, and marks the firing lane (slot X) as
 * spent so the caller's post-scan teardown can reclaim it.
 *
 * Behavior: fire the sound cue via gateSound1f. Stage the object's source depth into scratch loc_29 from
 * loc_2db,y ($2db,y) and its target segment into COORD_LIST_PTR_HI ($2d) from loc_2b5,y ($2b5,y). Re-insert
 * a zeroed object of type 0 (insertTimedObjectOfType) to retract its draw record, then clear the slot cell
 * loc_2db,y. Decrement the live count ACTIVE_ENEMY_COUNT ($a6). Finally flag lane X spent by writing
 * HIT_TALLY,x ($2f2,x) = 0xff -- the sentinel resolveSlotProximityInteractions checks after its scan.
 *
 * Live-out: loc_2db,y cleared; ACTIVE_ENEMY_COUNT decremented; HIT_TALLY,x = 0xff (spent-slot sentinel);
 * loc_29 / COORD_LIST_PTR_HI hold staging scratch. Grounding: seen.
 */
export function retireSpawnedObject(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  gateSound1f(m, x, y);                                 // destruction sound cue
  mem8[loc_29] = mem8[u16(loc_2db + y)];                // stage source depth
  mem8[COORD_LIST_PTR_HI] = mem8[u16(loc_2b5 + y)];     // stage target segment into list anchor $2d
  insertTimedObjectOfType(m, 0x00, x, y);               // retract the draw record (type 0)
  mem8[u16(loc_2db + y)] = 0x00;                        // empty the slot
  mem8[ACTIVE_ENEMY_COUNT]--;                           // one fewer live object
  mem8[u16(HIT_TALLY + x)] = 0xff;                      // mark lane X spent for the caller's teardown
}
