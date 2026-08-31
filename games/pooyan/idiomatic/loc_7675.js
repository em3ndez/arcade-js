// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import {
  SHARED_PHASE_COUNTDOWN,
  ENEMY_ACTOR_TABLE,
  OBJECT_STATE_RECORD_BASE,
  ATTRACT_SUBSTATE,
  SPAWN_RING_COUNTER,
} from "./names.js";

// Each enemy-actor / object record is a fixed-size struct laid out back-to-back in RAM.
// A record's dispatch state lives in its third byte (offset +2); records are spaced STRIDE
// bytes apart. The reseed step below walks two of those record arrays by hand.
const STATE_FIELD = 0x02; //     offset of the dispatch state byte inside a record
const STRIDE = 0x18; //          record-to-record stride: 0x18 (24) bytes per record
const STATE_SEEDED = 0x02; //    state value written into each enemy record on reseed (= state 2, the hold state)
const SEED_COUNT = 0x08; //      number of enemy-actor records reseeded when the phase countdown lapses
const CLEAR_COUNT = 0x06; //     number of object-state records cleared when the phase countdown lapses
const SUBSTATE_ON_EXPIRY = 0x08; // value written into the attract/demo sub-state selector on lapse

/**
 * loc_7675 — enemy-actor animation tick, STATE 1: "wait out the phase, then reseed the wave".
 *
 * WHAT IT IS
 *   One of the three per-entry state handlers that make up the enemy-actor animation tick
 *   (ROM 0x7638-0x76ae). Every enemy-actor record carries a dispatch state byte at offset +2.
 *   The tick dispatcher at ROM 0x7638 reads that byte, masks it to the range 0..2, and hands
 *   the record to the matching handler:
 *     state 0 (ROM 0x7644) — advance one entry's frame; once a run of frames completes it
 *                            kicks EVERY record over into state 1;
 *     state 1 (ROM 0x7675, this routine) — pace out a shared phase countdown, then, at zero,
 *                            reseed the whole wave;
 *     state 2 (ROM 0x76a6) — a plain hold: gate on a flag and otherwise just step animation.
 *
 * ROLE IN THE MACHINE
 *   Reached once per record from advanceEnemyActorStateWalk (ROM 0x7627), the shared
 *   per-frame walk that steps a run of enemy-actor records (stride 0x18) in table order.
 *   This handler is the phase-transition gate for that walk: it meters the interval between
 *   wave phases off one shared countdown, and when the countdown lapses it flips the entire
 *   enemy pool into its hold state, wipes the object-state records and the spawn ring
 *   counter, and bumps the attract/demo sub-state — the once-per-phase hand-off that starts
 *   the next stretch of the sequence.
 *
 * ROM ADDRESS: 0x7675-0x76a5.
 *
 * GROUNDING
 *   Reached as state 1 of advanceEnemyActorStateWalk (ROM 0x7627, cert [seen]); every memory
 *   cell it touches carries the [seen] tag in the symbol table: SHARED_PHASE_COUNTDOWN
 *   (0x892e), ENEMY_ACTOR_TABLE (0x8ae0), OBJECT_STATE_RECORD_BASE (0x8ba0), SPAWN_RING_COUNTER
 *   (0x8d57), and ATTRACT_SUBSTATE (0x8e51).
 *
 * RETURN — what the wave walk reads back
 *   true  — the phase countdown is still running: this record's animation was stepped and the
 *           walk should carry on to the next record.
 *   false — the countdown reached zero and the wave was reseeded: the whole per-frame walk is
 *           abandoned for this frame (no further records are ticked), because the pool has just
 *           changed state out from under the sweep.
 *
 * LIVE-OUT — what it leaves in memory
 *   Always: this record's stepped animation (frame-hold counter + script cursor), and — while
 *   the countdown was still running — SHARED_PHASE_COUNTDOWN decremented by one.
 *   On the reseed (countdown hit zero):
 *     - the state byte of 8 enemy-actor records set to state 2 (hold),
 *     - the state byte of 6 object-state records cleared to 0,
 *     - SPAWN_RING_COUNTER cleared, and
 *     - ATTRACT_SUBSTATE set to 8.
 */
export function loc_7675(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Step this record's own animation first, unconditionally — advance its frame-hold
  // countdown and, on a lapse, walk its animation script forward (ROM 0x4006). Whether we
  // keep walking or reseed below, this entry's sprite still animates this frame.
  advanceObjectAnimationFrame(m, ix); // step this entry's animation

  // Phase gate: SHARED_PHASE_COUNTDOWN (0x892e) is the single timer that paces the interval
  // between wave phases. While it is still running, this state does nothing but tick it down
  // and let the walk continue — the wave is simply holding here.
  if (mem8[SHARED_PHASE_COUNTDOWN] !== 0) {
    mem8[SHARED_PHASE_COUNTDOWN] = mem8[SHARED_PHASE_COUNTDOWN] - 1; // still counting -> keep walking
    return true;
  }

  // --- The countdown has lapsed: reseed the wave. ---

  // Flip the enemy-actor pool into its hold state: write state 2 (STATE_SEEDED) into the
  // dispatch state byte (offset +2) of 8 consecutive ENEMY_ACTOR_TABLE (0x8ae0) records,
  // stepping STRIDE (0x18) bytes from one record's state byte to the next. u16() keeps the
  // running address inside the 16-bit memory space.
  let rec = ENEMY_ACTOR_TABLE + STATE_FIELD;
  for (let n = 0; n < SEED_COUNT; n++) {
    mem8[rec] = STATE_SEEDED;
    rec = u16(rec + STRIDE);
  }

  // Wipe the object-state records: clear the dispatch state byte (offset +2) of 6 consecutive
  // OBJECT_STATE_RECORD_BASE (0x8ba0) records back to state 0, again stepping by STRIDE. These
  // are the per-frame object slots the state dispatcher sweeps; zeroing their state retires
  // them so the next phase starts from a clean pool.
  rec = OBJECT_STATE_RECORD_BASE + STATE_FIELD;
  for (let n = 0; n < CLEAR_COUNT; n++) {
    mem8[rec] = 0x00;
    rec = u16(rec + STRIDE);
  }

  // Clear the spawn ring counter (SPAWN_RING_COUNTER, 0x8d57): the object cluster's state-0
  // handler increments it as it arms objects around the ring; the phase reset zeroes it so the
  // next phase's arming starts from the beginning of the ring.
  mem8[SPAWN_RING_COUNTER] = 0x00;
  // Advance the attract/demo sub-state selector (ATTRACT_SUBSTATE, 0x8e51) to 8, the value
  // this phase transition hands to the sub-state dispatch table for the next stretch.
  mem8[ATTRACT_SUBSTATE] = SUBSTATE_ON_EXPIRY;
  return false; // reseed done -> abandon the rest of this frame's walk
}
