// SPDX-License-Identifier: GPL-3.0-only
import { tickTargetGroupCounterAndQueueDisplay } from "./tickTargetGroupCounterAndQueueDisplay.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  TARGET_GROUP_COUNT,
  INTRO_DELAY_CKSUM_WORD,
  INTRO_PHASE_INDEX,
  INTRO_PHASE5_TOGGLE,
  INTRO_PHASE5_DISPLAY_CMD_A,
  DISPLAY_CMD_0627,
} from "./names.js";
/**
 * advanceLevelIntroFromPhase5 -- level-intro phase 5.  [seen]  ROM 0x7032-0x7058
 *
 * WHAT IT IS
 *   One frame of phase 5 of the level-intro / round-start choreography. Before a round in
 *   the deep (round-2-and-beyond) world begins, the machine steps a small state machine that
 *   paints the round banner and shows the group of targets the player is about to face. That
 *   state machine is a phase selector, INTRO_PHASE_INDEX (0x8f51), running 0..6; each phase
 *   is one handler, and this routine is the handler for phase 5 -- the dwell that holds the
 *   banner on screen, animates it, and drains the group counter before handing off to phase 6.
 *
 * ITS ROLE IN THE MACHINE
 *   The per-frame level-intro phase dispatcher (dispatchLevelIntroPhase, 0x6da6) reads
 *   INTRO_PHASE_INDEX and vectors to the matching phase handler. While the index sits at 5,
 *   every frame lands here. Phase 5 does three things per frame: it winds down the group of
 *   targets shown in the banner, it counts a hold timer down, and while it waits it pulses a
 *   display command every sixteenth frame so the banner blinks/animates. When the hold timer
 *   runs out it bumps INTRO_PHASE_INDEX so the dispatcher moves on to phase 6 next frame.
 *
 * LIVE-OUT
 *   None. The phase dispatcher hands the frame to this handler and reads nothing back from it;
 *   the whole contract is the memory this routine leaves behind -- the ticked TARGET_GROUP_COUNT
 *   (0x8f47), the decremented (or reseeded) delay INTRO_DELAY_CKSUM_WORD (0x8f48), the advanced
 *   INTRO_PHASE_INDEX (0x8f51) at hand-off, the toggled INTRO_PHASE5_TOGGLE (0x8f54), and the
 *   display command left on the display-command ring.
 */
export function advanceLevelIntroFromPhase5(m) {
  const { mem8 } = m;

  // STEP 1 -- drain the target-group counter shown in the banner.
  // TARGET_GROUP_COUNT (0x8f47) holds how many targets are in the group the intro banner is
  // presenting. While it is still nonzero, a helper ticks it down one and queues the display
  // command (0x0315) that drives its intro sound/animation, so the banner counts the group off
  // over the dwell. At zero the group is fully shown and this step is skipped.
  if (mem8[TARGET_GROUP_COUNT] !== 0) tickTargetGroupCounterAndQueueDisplay(m, TARGET_GROUP_COUNT); // tick the group + queue sound

  // STEP 2 -- when the hold timer has already expired, hand off to phase 6.
  // INTRO_DELAY_CKSUM_WORD (0x8f48, used here as the intro-phase hold timer) is the countdown
  // that keeps the banner on screen. If it is already 0 the dwell is over: reseed the timer to
  // 0x20 (so the machine is ready the next time a phase uses this cell as a delay) and bump the
  // phase selector INTRO_PHASE_INDEX (0x8f51) by one, moving the dispatcher on to phase 6. The
  // selector is a single byte, so the increment wraps at 0xff.
  if (mem8[INTRO_DELAY_CKSUM_WORD] === 0) {
    mem8[INTRO_DELAY_CKSUM_WORD] = 0x20; // reseed the delay
    mem8[INTRO_PHASE_INDEX] = mem8[INTRO_PHASE_INDEX] + 1; // advance to phase 6 (byte write wraps)
    return;
  }

  // STEP 3 -- otherwise tick the hold timer down by one.
  // The timer is a single byte, so the decrement is masked to 8 bits before it is written back
  // to INTRO_DELAY_CKSUM_WORD (0x8f48). Most frames end right here: the banner only refreshes on
  // a boundary, so unless the new value's low nibble is zero (i.e. every sixteenth frame) there
  // is nothing more to do this frame and the handler returns.
  const delay = (mem8[INTRO_DELAY_CKSUM_WORD] - 1) & 0xff;
  mem8[INTRO_DELAY_CKSUM_WORD] = delay;
  if ((delay & 0x0f) !== 0) return; // not a 16-frame boundary

  // STEP 4 -- on each sixteenth frame, flip the toggle and pulse the banner's display command.
  // INTRO_PHASE5_TOGGLE (0x8f54) is bumped once per boundary; its new bit0 alternates 0/1 across
  // successive boundaries, so the banner alternates between two display commands to make it blink
  // or animate. bit0 set selects DISPLAY_CMD_0627 (0x0627); bit0 clear selects
  // INTRO_PHASE5_DISPLAY_CMD_A (0x06a7). The chosen command word is dropped onto the
  // display-command ring for the display driver to act on.
  const toggled = (mem8[INTRO_PHASE5_TOGGLE] + 1) & 0xff;
  mem8[INTRO_PHASE5_TOGGLE] = toggled;
  const cmd = (toggled & 0x01) ? DISPLAY_CMD_0627 : INTRO_PHASE5_DISPLAY_CMD_A;
  enqueueDisplayCommand(m, cmd); // enqueue the chosen display command
}
