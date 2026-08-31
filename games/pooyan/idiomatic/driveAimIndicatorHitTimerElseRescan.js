// SPDX-License-Identifier: GPL-3.0-only
import { clearAimIndicatorUnlessProximityHit } from "./clearAimIndicatorUnlessProximityHit.js";
import { AIM_INDICATOR_MODE, AIM_INDICATOR_TIMER, PLAYER_AIM_FLAGS } from "./names.js";

/**
 * driveAimIndicatorHitTimerElseRescan  --  ROM 0x6bee  --  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame stepper for the player-arrow's AIM INDICATOR. When the arrow is
 *   idle (the game not in active play), the machine helps the player line the arrow
 *   up on the nearest enemy by lighting a small directional cue on the arrow: an
 *   "above" / on-target mark or a "below" mark. Those two cues live in two bits of
 *   the player-actor state byte PLAYER_AIM_FLAGS (0x8a87): bit2 (0x04) = above /
 *   on-target, bit3 (0x08) = below. This routine is what turns each cue on and holds
 *   it lit for a short window before releasing it.
 *
 * ROLE IN THE MACHINE
 *   It is the inner step of the aim-acquisition updater acquireTargetLockAndSetAimIndicator
 *   (ROM 0x6cab), which runs once per frame while the game is idle. That updater has
 *   already decided, on a target-acquired event, WHICH way the nearest enemy sits
 *   relative to the arrow, and recorded that as a small state machine in two work-RAM
 *   cells:
 *     - AIM_INDICATOR_MODE  (0x8d52): direction/mode latch. 0 = no cue held, run the
 *                                     rescan/redraw pass; 1 = hold the "above" cue;
 *                                     2 (or higher) = hold the "below" cue. It is set
 *                                     to 1 or 2 at the moment a target is acquired.
 *     - AIM_INDICATOR_TIMER (0x8d53): countdown for how long that cue stays lit
 *                                     (loaded to 0x18 = 24 frames on acquisition).
 *   Hence the name: on a HIT, run the hold TIMER for the acquired cue; ELSE (mode 0)
 *   RESCAN by running the proximity redraw pass.
 *
 * LIVE-OUT
 *   Its effect is entirely in memory -- the aim bits of PLAYER_AIM_FLAGS (0x8a87),
 *   the countdown AIM_INDICATOR_TIMER (0x8d53), and, at expiry, the mode latch
 *   AIM_INDICATOR_MODE (0x8d52). It leaves nothing in a register: the caller re-reads
 *   those cells on the next frame.
 */

const AIM_ABOVE = 0x04; // PLAYER_AIM_FLAGS (0x8a87) bit2 -- the "above" / on-target cue
const AIM_BELOW = 0x08; // PLAYER_AIM_FLAGS (0x8a87) bit3 -- the "below" cue

export function driveAimIndicatorHitTimerElseRescan(m) {
  const { mem8 } = m;
  // Read the direction/mode latch AIM_INDICATOR_MODE (0x8d52) that selects this
  // frame's behaviour: 0 = idle rescan, 1 = hold "above", 2+ = hold "below".
  const mode = mem8[AIM_INDICATOR_MODE];

  // --- Mode 0: no cue is being held, so run the proximity rescan/redraw pass. ---
  // clearAimIndicatorUnlessProximityHit (ROM 0x6c18) sweeps the projectile records
  // against the fixed sprite record: if one is within striking range it leaves the
  // aim cue standing, otherwise it clears the aim bits and the proximity-hit flag.
  // This is the resting state -- keep re-testing until a target is acquired.
  if (mode === 0) {
    clearAimIndicatorUnlessProximityHit(m); // proximity rescan / redraw pass
    return;
  }

  // --- Modes 1 and 2: a target was acquired; light the correct directional cue. ---
  // Exactly one of the two aim bits is shown at a time, so each branch sets its own
  // bit in PLAYER_AIM_FLAGS (0x8a87) and clears the other.
  if (mode === 1) {
    // Mode 1: enemy sits above / on target -- raise bit2, drop bit3.
    mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_ABOVE) & ~AIM_BELOW;
  } else {
    // Mode 2 (or higher): enemy sits below -- raise bit3, drop bit2.
    mem8[PLAYER_AIM_FLAGS] = (mem8[PLAYER_AIM_FLAGS] | AIM_BELOW) & ~AIM_ABOVE;
  }

  // --- Age the hold window. ---
  // Drain the hold countdown AIM_INDICATOR_TIMER (0x8d53) by one frame. While it is
  // still nonzero the cue keeps its bit lit and we simply return, leaving the mode
  // latch in place so the next frame re-lights the same cue.
  mem8[AIM_INDICATOR_TIMER] = mem8[AIM_INDICATOR_TIMER] - 1;
  if (mem8[AIM_INDICATOR_TIMER] !== 0) return;
  // Countdown reached zero: the hold window is over. Clear the mode latch
  // AIM_INDICATOR_MODE (0x8d52) back to 0, so the next frame falls into the mode-0
  // rescan branch above and the indicator is free to re-acquire.
  mem8[AIM_INDICATOR_MODE] = 0x00;
}
