// SPDX-License-Identifier: GPL-3.0-only
/**
 * armObjectAnimAndRequestSound — sub-state 0 (entry phase) of a deactivated object's death animation:
 * seed the animation timers, advance the object's sub-state so this runs once, and post a
 * position-keyed sound request.
 *
 * WHAT IT IS
 *   When an object is killed it is not removed at once; driveObjectSlot diverts it (via its death flag)
 *   to a short animation run by dispatchDeactivatedObjectAnim (0x10e4), which reads the record's
 *   animation sub-state (record+2) and tail-dispatches to one of four phase handlers. This is phase 0,
 *   the entry: it primes the timer fields the per-frame phases will count down, steps the sub-state so
 *   the dispatcher lands on phase 1 next frame, and requests a death sound effect.
 *
 * ROLE IN THE MACHINE
 *   The routine works on one object record, based at `obj` (defaulting to IX, the record the dispatcher
 *   selected). Record fields are byte offsets from that base: SUBSTATE (record+2) is the animation
 *   sub-state the dispatcher reads; FRAME_DIVIDER (record+16), STEP_COUNT (record+17) and STEP_FIELD
 *   (record+18) are the animation timer fields the later phases decrement; POS_FIELD (record+7) is the
 *   object's screen-position byte. The sound request is posted into the shared selector loc_41df
 *   (0x41df) — the same cell armSoundSequenceBySelector/armSoundSequenceForSelector16 later read — and
 *   is keyed on the object's position: below the threshold 112 it requests the low effect (0x07), at or
 *   above it the high effect (0x17).
 *
 * ROM 0x10f0.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: record fields +16/+17/+18 seeded, record+2 incremented, and loc_41df = 0x07 or 0x17.
 */
import { loc_41df } from "./names.js";

// Object-record field offsets (bytes from the record base).
const SUBSTATE = 2;
const FRAME_DIVIDER = 16;
const STEP_COUNT = 17;
const STEP_FIELD = 18;
const POS_FIELD = 7;

// Starting values seeded into the timer fields (counted down by the later animation phases).
const FRAME_DIVIDER_INIT = 4;
const STEP_COUNT_INIT = 4;
const STEP_FIELD_INIT = 28;

// Sound-request selector: position byte below the threshold picks the low effect, at/above it the high.
const POS_THRESHOLD = 112;
const SOUND_REQ_LOW = 0x07;
const SOUND_REQ_HIGH = 0x17;

export function armObjectAnimAndRequestSound(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Arm the animation timers for this phase: the fast frame divider, the step count, and the step field
  // that the per-frame phase handlers (tickDeactivatedObjectAnim, endObjectAnimOnTimerExpiry) run down.
  mem8[obj + FRAME_DIVIDER] = FRAME_DIVIDER_INIT;
  mem8[obj + STEP_COUNT] = STEP_COUNT_INIT;
  mem8[obj + STEP_FIELD] = STEP_FIELD_INIT;

  // Advance the sub-state so dispatchDeactivatedObjectAnim runs the per-frame animator (phase 1) next
  // time; this entry phase therefore executes exactly once per death.
  mem8[obj + SUBSTATE]++;

  // Post the death-sound request into the shared selector, keyed off the object's screen position:
  // near the bottom of the field (pos >= 112) request the high effect, higher up request the low one.
  mem8[loc_41df] =
    mem8[obj + POS_FIELD] >= POS_THRESHOLD ? SOUND_REQ_HIGH : SOUND_REQ_LOW;
}
