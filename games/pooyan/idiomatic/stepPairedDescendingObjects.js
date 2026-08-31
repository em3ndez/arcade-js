// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advancePairedDescendingObjectStep } from "./advancePairedDescendingObjectStep.js";
import { ENEMY_ACTOR_TABLE, OBJECT_STATE_RECORD_BASE } from "./names.js";
/**
 * stepPairedDescendingObjects — step eight paired descending-object records through the per-record stepper.
 *
 * WHAT IT IS
 *   The per-frame batch driver for the game's descending objects. A descending object is not one
 *   record but two that travel together: a PRIMARY record in the enemy-actor pool (the motion / actor
 *   half) and a PAIRED record in the object-state pool (its second half). Once per frame this driver
 *   walks eight such pairs and moves every one of them down a single motion step.
 *
 * ROLE IN THE MACHINE
 *   One of the four object sub-passes issued every frame. This routine is only the outer sweep — it
 *   supplies the (ix, iy) pair for each of the eight descending objects and leaves all the real
 *   per-object work (advance the animation, lower both 16-bit positions, arm the mid-fall blink phase,
 *   and retire an object that has hit the floor) to advancePairedDescendingObjectStep. The two record
 *   pools live one fixed stride apart, so a single counter and a shared stride carry both cursors.
 *
 *   ROM 0x69ad (0x69ad-0x69c5).  Grounding: [seen].
 *
 * LIVE-OUT: memory only — a per-frame sweep whose caller consumes no result. Whatever the per-record
 * stepper leaves behind (moved positions, a bumped blink-phase gate, or wiped/retired records) is the
 * only effect; nothing is reported back.
 */

const RECORD_STRIDE = 0x18; // bytes between one paired record and the next (record size in both pools)
const PAIR_COUNT = 8; //       number of (ix, iy) record pairs swept each frame

export function stepPairedDescendingObjects(m) {
  // Seat the two cursors at the head of their pools. The PRIMARY (ix) cursor scans the enemy-actor
  // record pool at ENEMY_ACTOR_TABLE (0x8ae0); the PAIRED (iy) cursor scans the object-state record
  // array at OBJECT_STATE_RECORD_BASE (0x8ba0). Both pools lay their records out at the same stride,
  // so the two cursors move in lockstep, one primary/paired object apart.
  let ix = ENEMY_ACTOR_TABLE;
  let iy = OBJECT_STATE_RECORD_BASE;
  // Sweep all eight descending objects. Each pass hands the current pair to the per-record stepper,
  // which moves that one object down a step and decides (from the primary object's altitude) whether
  // to arm the blink phase or retire the object.
  for (let n = 0; n < PAIR_COUNT; n++) {
    advancePairedDescendingObjectStep(m, ix, iy);
    // Step both cursors to the next record in their pools. Adding the record stride advances by exactly
    // one object; u16 keeps each address within the 16-bit address space, matching how the machine's
    // pointer arithmetic wraps.
    ix = u16(ix + RECORD_STRIDE);
    iy = u16(iy + RECORD_STRIDE);
  }
}
