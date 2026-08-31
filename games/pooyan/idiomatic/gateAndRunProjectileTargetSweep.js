// SPDX-License-Identifier: GPL-3.0-only
import { sweepTargetSlotsForGrab } from "./sweepTargetSlotsForGrab.js";
import { GRAB_ACTIVE_FLAG, FORMATION_STATE, WAVE_TEARDOWN_STATE, SPRITE_DISPLAY_LIST, SPRITE_TARGET_SLOTS, PROJECTILE_TABLE } from "./names.js";
/**
 * gateAndRunProjectileTargetSweep — gate and seed the rope-grab proximity sweep.
 *
 * WHAT IT IS
 *   ROM 0x5df7 (0x5df7-0x5e10). The gate that decides, once a frame, whether the grab-collision
 *   scan is even worth running, and — when it is — points that scan at the three fixed tables it
 *   works over before handing off to the inner sweep.
 *
 *   A "grab" is the moment Pooyan's fired arrow/rope tip reaches a hanging object dangling on a
 *   descending balloon-rope and catches it. Every frame the actor-update pipeline offers this
 *   routine a chance to test for that catch, but a catch is only meaningful under some conditions,
 *   so this routine screens them first and stays completely inert when any screen fails.
 *
 * ROLE IN THE MACHINE
 *   One of the eleven per-record passes fired in fixed order by the master per-frame actor updater.
 *   That updater reads nothing back from any pass — every effect happens through the shared record
 *   tables — so this routine's whole job is (1) three gate checks and, if they all clear, (2) aiming
 *   the inner sweep at its tables and running it. The inner sweep and the per-slot grab trigger
 *   underneath it do all the real work: raising the grab latch, snapping a caught object into its
 *   landing animation, and firing the grab sound.
 *
 *   The three tables it aims the sweep at:
 *     - the sprite display list (SPRITE_DISPLAY_LIST, 0x8840) as the fixed reference object — the
 *       arrow/rope tip, supplying the catch-window centre; the SAME object is tested against every
 *       slot, so this pointer never advances;
 *     - the sprite target slots (SPRITE_TARGET_SLOTS, 0x887c) as the per-slot comparison
 *       coordinates measured against that centre;
 *     - the projectile table (PROJECTILE_TABLE, 0x8be8) as the per-slot records under test.
 *   It then sweeps SLOT_COUNT (three) slots. The sweep aborts itself the instant a grab connects,
 *   because only one catch can happen at a time.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none. The sweep is a tail delegate with no live-out, and the per-frame updater that
 * invokes this routine reads nothing back from it.
 */

// Three slots are swept: the projectile table has three record slots, paired one-to-one with the
// first three sprite target coordinates.
const SLOT_COUNT = 0x03;

export function gateAndRunProjectileTargetSweep(m) {
  const { mem8 } = m;
  // GATE 1 — bail if a grab is already in progress. GRAB_ACTIVE_FLAG (0x8d32) is raised to 1 the
  // moment a rope-grab fires and stays set while the caught object plays out its catch. Testing for
  // a fresh grab while one is still latched would be meaningless, so a nonzero latch skips the whole
  // scan this frame.
  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return;
  // GATE 2 — bail while the enemy formation is busy. FORMATION_STATE (0x8f08) is nonzero while the
  // enemy formation is gathering/dispatching launch-ready slots, and WAVE_TEARDOWN_STATE (0x8f24) is
  // nonzero while a wave is being torn down or the boss is being walked offscreen. Either one marks
  // the field as "busy" — no new grabs are allowed to connect during those phases — so their OR
  // being non-zero also skips the scan.
  if ((mem8[FORMATION_STATE] | mem8[WAVE_TEARDOWN_STATE]) !== 0) return;
  // All gates clear: run the three-slot grab proximity sweep. The arguments seed the sweep's fixed
  // pointers — the projectile records to test, the arrow/rope tip as the shared reference object,
  // the sprite target coordinates, and the slot count — after which the inner sweep walks the slots
  // and aborts on the first catch.
  sweepTargetSlotsForGrab(m, PROJECTILE_TABLE, SPRITE_DISPLAY_LIST, SPRITE_TARGET_SLOTS, SLOT_COUNT);
}
