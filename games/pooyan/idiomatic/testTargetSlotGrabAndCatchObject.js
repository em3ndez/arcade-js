// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommand0D } from "./queueSoundCommand0D.js";
import { FLIP_SCREEN_FLAG, GRAB_ACTIVE_FLAG, LANDING_ANIM_SEQ_40B4 } from "./names.js";
/**
 * testTargetSlotGrabAndCatchObject  (ROM 0x5e1f) -- the per-slot GRAB TRIGGER.
 *
 * WHAT IT IS
 *   One iteration of the frame's grab proximity sweep. Each frame the collision pipeline runs a
 *   gated grab sweep -- gateAndRunProjectileTargetSweep bails while a grab is already latched or a
 *   formation/wave-teardown is busy, then seeds a fixed source object plus a target/record pointer
 *   pair and a slot count and hands them, slot by slot, to sweepTargetSlotsForGrab. This routine IS
 *   the inner test that sweepTargetSlotsForGrab runs against one slot: it asks "does this slot's
 *   target point sit inside the source object's small catch window?" and, on a yes, fires the grab.
 *
 *   The catch is what happens when Pooyan's arrow/rope reaches a hanging object: the object is
 *   caught, snapped into its landing/settle animation, and a grab is announced to the rest of the
 *   machine so no new spawns or wave events step on the grab in progress.
 *
 * ROLE IN THE MACHINE
 *   Returns true on every "no grab" path so the caller keeps sweeping the remaining slots, and
 *   false on the "grab hit" path so the whole sweep is abandoned for this frame (a catch is a
 *   one-at-a-time event -- once one connects there is nothing left to test).
 *
 * ARGUMENTS (all point at live records)
 *   rec    -- the record under test: its header byte gates the test, and on a hit it is the record
 *             that receives the landing animation and the seeded actor fields (it becomes the caught
 *             object).
 *   source -- the fixed source object supplying the catch-window CENTRE: its screen X at +0 and
 *             screen Y at +2.
 *   target -- the target-coordinate slot being measured against that centre: its X at +0, Y at +2.
 *
 * GROUNDING
 *   This dissolved inner step serves the [seen] grab sweep (gateAndRunProjectileTargetSweep ->
 *   sweepTargetSlotsForGrab). The latch it raises, GRAB_ACTIVE_FLAG, and the orientation flag it
 *   reads, FLIP_SCREEN_FLAG, both carry the [seen] tag.
 *
 * LIVE-OUT: boolean only (true = continue the sweep, false = abort it). No register value survives
 * for the caller -- on a hit the record it addressed has been mutated in place, and the grab latch
 * GRAB_ACTIVE_FLAG is left raised for the rest of the machine to observe.
 */

export function testTargetSlotGrabAndCatchObject(m, rec = m.regs.hl, source = m.regs.ix, target = m.regs.iy) {
  const { mem8 } = m;

  // STEP 1 -- header gate.
  // The record's first byte is its state/header. State 0 (empty slot) and state 5 are not
  // grab-eligible, so they short-circuit to "no grab, keep sweeping" without touching coordinates.
  const state = mem8[rec];
  if (state === 0x00 || state === 0x05) return true;

  // STEP 2 -- pick the orientation-dependent catch offset.
  // FLIP_SCREEN_FLAG (0x881f) is 1 for the normal upright cabinet and 0 for the mirrored
  // (cocktail) view. The catch window sits a fixed distance from the source object's stored
  // coordinate; when the screen is mirrored that distance flips sign on X (+9 -> -9, i.e. 0xf7)
  // and shifts +16 on Y, so the window lands on the same on-screen spot in either orientation.
  let offX, offY;
  if (mem8[FLIP_SCREEN_FLAG] !== 0) {
    offX = 0x09;
    offY = 0x00;
  } else {
    offX = 0xf7;
    offY = 0x10;
  }

  // STEP 3 -- build the catch-window centre from the source object.
  // tx/ty are the source object's screen coordinates (source+0 = X, source+2 = Y) nudged by the
  // orientation offset, wrapped to a byte just as the hardware coordinate would wrap.
  const tx = (mem8[source + 0x00] + offX) & 0xff;
  const ty = (mem8[source + 0x02] + offY) & 0xff;

  // STEP 4 -- X-axis proximity test.
  // Take |dx| between the target slot's X (target+0) and the centre. Anything two pixels or more
  // off in X is a miss: return true so the caller advances to the next slot.
  const bx = mem8[target + 0x00];
  let dx = (bx - tx) & 0xff;
  if (bx < tx) dx = (-dx) & 0xff; // borrow -> two's complement gives |dx|
  if (dx >= 0x02) return true;

  // STEP 5 -- Y-axis proximity test.
  // The target's Y (target+2) is biased +8 to line the window up with the object's centre, then
  // |dy| is measured against the centre. Nine rows or more apart is a miss: return true.
  const by = (mem8[target + 0x02] + 0x08) & 0xff;
  let dy = (by - ty) & 0xff;
  if (by < ty) dy = (-dy) & 0xff;
  if (dy >= 0x09) return true;

  // STEP 6 -- the grab connects.
  // Both axes are inside the window, so the object is caught. Announce the grab to the rest of the
  // machine: GRAB_ACTIVE_FLAG (0x8d32) stays raised so spawn and wave-event routines hold off while
  // the grab plays out.
  mem8[GRAB_ACTIVE_FLAG] = 0x01;
  // Point the caught record at the landing/settle animation sequence LANDING_ANIM_SEQ_40B4 (0x40b4)
  // and restart it, so the object visibly snaps into its caught pose.
  setActorAnimation(m, rec, LANDING_ANIM_SEQ_40B4);
  // Seed the caught record's fields: +0x11 is its per-record countdown timer (armed to 0x0a), and
  // the header triplet is reset to 0/1/2 -- clearing the state byte and installing the caught
  // object's starting sub-state.
  mem8[rec + 0x11] = 0x0a;
  mem8[rec + 0x00] = 0x00;
  mem8[rec + 0x01] = 0x01;
  mem8[rec + 0x02] = 0x02;
  // Fire the grab sound (fixed sound command 0x0d) onto the audio-command ring.
  queueSoundCommand0D(m);
  // Report the hit: false tells the caller to abandon the rest of the sweep for this frame.
  return false;
}
