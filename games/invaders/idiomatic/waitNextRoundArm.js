// SPDX-License-Identifier: GPL-3.0-only
import { isArmTriggerSet } from "./isArmTriggerSet.js";
import { FRAME_DELAY_TIMER } from "./names.js";

/**
 * waitNextRoundArm -- the busy-wait handshake that paces the hand-off into the next round.
 *
 * WHAT IT IS
 *   Between rounds the spine parks here until the arm trigger has cycled to the state that says the next
 *   round may begin. The trigger has an "armed" value (0xff, read by isArmTriggerSet against [loc_2015]).
 *   This wait handles both entry states: if the trigger is already armed, it holds briefly and then watches
 *   for the trigger to leave and return; if the trigger is not armed, it simply waits for it to arm.
 *
 * ROLE IN THE MACHINE
 *   Seeds and spins on FRAME_DELAY_TIMER (0x20c0), the busy-wait counter the vblank interrupt decrements
 *   once per displayed frame -- the same counter the attract delays and the round-start splash drain. Polls
 *   the arm trigger through isArmTriggerSet ([loc_2015]==0xff). Each pass yields one frame; the interrupt
 *   drains the counter and any handler may update the trigger. Part of the round-restart cluster.
 *
 * ROM 0x0a3c.  Grounding: §4 clock-free spine generator (isArmTriggerSet carries a [seen] cert; the wait's
 * frame-paced timing is exercised by the frame-stepped gate).
 *
 * LIVE-OUT: generator, returns nothing; memory only.
 */
export function* waitNextRoundArm(m) {
  // Entry case A -- the trigger is already armed. Hold for up to 0x30 (48) frames, re-polling each frame.
  if (isArmTriggerSet(m)) {
    m.mem8[FRAME_DELAY_TIMER] = 0x30;
    for (;;) {
      // Timed out at the armed value: proceed to the next round without waiting for the trigger to cycle.
      if (m.mem8[FRAME_DELAY_TIMER] === 0) return;
      // The trigger left the armed value within the window: stop the timed hold and wait for it to return.
      if (!isArmTriggerSet(m)) break;
      // Still armed and time left: spend one frame (the interrupt drains FRAME_DELAY_TIMER).
      yield;
    }
  }
  // Entry case B (or after the trigger left the armed value): wait until the trigger reads armed again.
  while (!isArmTriggerSet(m)) yield;
}
