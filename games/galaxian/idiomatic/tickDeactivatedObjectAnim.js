// SPDX-License-Identifier: GPL-3.0-only
import { loc_422d } from "./names.js";

// Object-record field offsets (the record is pointed at by IX). Byte 1 is the dying-animation flag, byte 2
// the animation sub-state index; the two timers and the companion field live in the record's tail.
const FAST_TIMER = 16;
const SLOW_TIMER = 17;
const COMPANION = 18;
const SUBSTATE = 2;
const STATE_BYTE = 1;
const POS_FIELD = 7;

// Animation constants: FAST_RELOAD (4) reloads the fast timer during the animation; FAST_RELOAD_FAR (50)
// is the longer reload used when the object is past the threshold; POS_THRESHOLD (112) splits the near
// ("retire") from the far ("continue") outcome; COMPANION_BIAS (32) is added to the global seed on reseed.
const FAST_RELOAD = 4;
const FAST_RELOAD_FAR = 50;
const POS_THRESHOLD = 112;
const COMPANION_BIAS = 32;

/**
 * tickDeactivatedObjectAnim (ROM 0x1112) -- sub-state 1 of the dying-object animation.
 *
 * WHAT IT IS
 *   When an object is killed its death flag (record byte 1 bit0) diverts it, in driveObjectSlot, away from
 *   AI and into a short death animation; dispatchDeactivatedObjectAnim vectors on the animation sub-state
 *   (record byte 2) to one of four phase handlers, and this is phase 1 -- the running animation itself.
 *   It drives a two-tier timer (a fast field that steps a companion each elapse, gated by a slow field) and,
 *   when the slow field elapses, decides the object's fate from its position byte.
 *
 * ROLE IN THE MACHINE
 *   See mechanisms.md "Object death animation". Sub-state 0 (armObjectAnimAndRequestSound) seeds the timers
 *   and posts the death sound; this sub-state 1 animates; sub-state 2 counts down and retires; sub-state 3
 *   is a no-op terminal slot. Retiring here clears the record so the slot is free for the next launch.
 *
 * Grounding: [seen] (names.js ROUTINES 0x1112).
 *
 * LIVE-OUT: memory. Operates entirely within the object record at IX -- the two timers (ix+16/ix+17), the
 *   companion (ix+18), the sub-state (ix+2), and the dying flag (ix+1). Reads the global loc_422d (0x422d).
 */
export function tickDeactivatedObjectAnim(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Fast field (ix+16): tick it down with 8-bit wrap. Until it hits zero there is nothing to do this frame
  // -- this is the inner animation cadence.
  const fast = (mem8[obj + FAST_TIMER] - 1) & 0xff;
  mem8[obj + FAST_TIMER] = fast;
  if (fast !== 0) return;

  // Fast field elapsed: reload it (=4) and step the companion field (ix+18) forward -- one animation step.
  mem8[obj + FAST_TIMER] = FAST_RELOAD;
  mem8[obj + COMPANION]++;

  // Slow field (ix+17): tick it down too; until it elapses the animation just keeps stepping the companion.
  const slow = (mem8[obj + SLOW_TIMER] - 1) & 0xff;
  mem8[obj + SLOW_TIMER] = slow;
  if (slow !== 0) return;

  // Slow field elapsed: the animation is over. Split on the position field (ix+7) against 112.
  if (mem8[obj + POS_FIELD] >= POS_THRESHOLD) {
    // Far side: keep the object alive for a follow-on effect -- reload the fast timer long (=50), reseed the
    // companion from the global loc_422d (0x422d) plus a bias of 32, and advance the animation sub-state.
    mem8[obj + FAST_TIMER] = FAST_RELOAD_FAR;
    mem8[obj + COMPANION] = mem8[loc_422d] + COMPANION_BIAS;
    mem8[obj + SUBSTATE]++;
  } else {
    // Near side: retire the object by clearing its dying/state byte (ix+1), freeing the slot.
    mem8[obj + STATE_BYTE] = 0; // retire the object
  }
}
