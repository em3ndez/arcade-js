// SPDX-License-Identifier: GPL-3.0-only
import {
  LAUNCH_SCRIPT_PTR,
  PLAY_STATE_INDEX,
  PLAY_MODE_LATCH,
  ENEMY_SPAWN_TIMER,
  ROUND_COUNTER,
  HUNTER_SPAWN_FLIP_FLAG,
  BONUS_STAGE_BANNER_DISPLAY_CMD,
} from "./names.js";
import { verifyRoutineChecksumOrDivert } from "./verifyRoutineChecksumOrDivert.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { queueSoundCommand13 } from "./queueSoundCommand13.js";

/**
 * announceBonusStageAndStartPlay — the bonus-stage intro countdown, and the moment play begins.
 *
 * WHAT IT IS
 *   The in-play sub-state handler that runs while a bonus stage is being announced. Pooyan's
 *   per-frame sub-state dispatcher reaches this body at play-state index 0x10, right after a
 *   round has been diverted onto the bonus-stage track. Everything it does hangs off a single
 *   countdown; the routine is called once per frame and simply advances that countdown one step,
 *   branching on where the step lands. The whole bonus-stage intro — banner up, hold, then hand
 *   off to live play — is choreographed by this one timer.
 *
 * ROLE IN THE MACHINE
 *   The countdown lives in the cell at LAUNCH_SCRIPT_PTR (0x8f4a). That cell is the enemy
 *   launch-script pointer during ordinary play; the bonus-stage intro borrows it as an 8-bit
 *   timer while the launch machine is idle. The timer is seeded to 0x40 by the phase that arms
 *   the bonus stage, so on the first tick the pre-decrement value is exactly the boundary 0x40:
 *   that is the frame the banner and its jingle are fired. It then coasts down frame by frame
 *   with nothing to do, and the frame it reaches 0 is the frame the bonus stage actually starts
 *   playing — the sub-state is cleared, play mode is latched, and the enemy spawn cadence is
 *   reloaded so hunters begin to appear.
 *
 * ROM: 0x1d6e (falls through 0x1d82).
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only; callers read no register result.
 *   - on the boundary frame: the "BONUS STAGE" banner display command is queued and its sound cue
 *     is fired (side effects of the two helper calls); LAUNCH_SCRIPT_PTR is one lower.
 *   - on the expiry frame: PLAY_STATE_INDEX cleared to 0, PLAY_MODE_LATCH = 0x02,
 *     ENEMY_SPAWN_TIMER reloaded to 0x40, and HUNTER_SPAWN_FLIP_FLAG raised to 1 unless
 *     ROUND_COUNTER bit 1 is set.
 */

const TIMER_BOUNDARY = 0x40; //   pre-decrement value that fires the banner/sound
const ROUND_BIT1 = 0x02; //       round-counter bit that suppresses the flip flag

export function announceBonusStageAndStartPlay(m) {
  const { mem8 } = m;

  // Tick the intro countdown. Read the timer's current value FIRST (this pre-decrement value is
  // what the branches below test), then write it back one lower. LAUNCH_SCRIPT_PTR (0x8f4a) is an
  // 8-bit cell, so the store keeps only the low byte — the countdown wraps within 0..0xff.
  const value = mem8[LAUNCH_SCRIPT_PTR]; // pre-decrement value drives the branch
  mem8[LAUNCH_SCRIPT_PTR] = value - 1; // write wraps to a byte

  // Boundary frame (seed value 0x40): raise the banner. The timer was seeded to exactly 0x40, so
  // this arm runs on the intro's first tick. Verify the ROM checksum first (the guard the machine
  // runs before it commits to a scripted display), then queue the "BONUS STAGE" banner display
  // command (word 0x0626, painted at VRAM 0x86d1) and fire its sound cue. Then return: the banner
  // is now on screen and the timer will keep coasting down on later frames.
  if (value === TIMER_BOUNDARY) {
    verifyRoutineChecksumOrDivert(m);
    enqueueDisplayCommand(m, BONUS_STAGE_BANNER_DISPLAY_CMD);
    queueSoundCommand13(m);
    return;
  }

  // Hold frames: any other nonzero value means the countdown is still running. The banner stays
  // up and there is nothing to do this frame — leave every state cell untouched and return.
  if (value !== 0) return; // still running

  // Expiry frame (value reached 0): commit the bonus stage into live play.
  // Clear the in-play sub-state index so the dispatcher leaves the intro handler and resumes the
  // normal round sub-states from the top.
  mem8[PLAY_STATE_INDEX] = 0;
  // Latch play mode 0x02 — the bonus-stage variant of the per-frame update/table-select paths.
  mem8[PLAY_MODE_LATCH] = 0x02;
  // Reload the enemy spawn cadence countdown to 0x40 so the bonus wave begins spawning promptly.
  mem8[ENEMY_SPAWN_TIMER] = 0x40;
  // Raise the hunter-spawn flip flag so launch state 2 bumps its sub-counter instead of enqueuing
  // the spawn display command — UNLESS ROUND_COUNTER bit 1 is set. Bit 1 is the round-2/deep-path
  // discriminator: on the deeper track the flip a first-round bonus stage would raise is suppressed.
  if ((mem8[ROUND_COUNTER] & ROUND_BIT1) === 0) mem8[HUNTER_SPAWN_FLIP_FLAG] = 0x01;
}
