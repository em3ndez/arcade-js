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
 * announceBonusStageAndStartPlay — tick the countdown timer and branch on where it lands.
 *
 * The timer is decremented every call. When its pre-decrement value is the boundary 0x40, run the
 * code-integrity check, enqueue the bonus-stage banner display command, and queue its sound. Any
 * other nonzero value does nothing further. When the pre-decrement value is zero the timer has
 * expired: clear the play-state index, latch play mode, reload the enemy-spawn timer, and — unless
 * bit 1 of the round counter is set — raise the hunter-spawn flip flag.
 *
 * LIVE-OUT: memory only; no register output is read by callers.
 */

const TIMER_BOUNDARY = 0x40; //   pre-decrement value that fires the banner/sound
const ROUND_BIT1 = 0x02; //       round-counter bit that suppresses the flip flag

export function announceBonusStageAndStartPlay(m) {
  const { mem8 } = m;
  const value = mem8[LAUNCH_SCRIPT_PTR]; // pre-decrement value drives the branch
  mem8[LAUNCH_SCRIPT_PTR] = value - 1; // write wraps to a byte

  if (value === TIMER_BOUNDARY) {
    verifyRoutineChecksumOrDivert(m);
    enqueueDisplayCommand(m, BONUS_STAGE_BANNER_DISPLAY_CMD);
    queueSoundCommand13(m);
    return;
  }

  if (value !== 0) return; // still running

  mem8[PLAY_STATE_INDEX] = 0;
  mem8[PLAY_MODE_LATCH] = 0x02;
  mem8[ENEMY_SPAWN_TIMER] = 0x40;
  if ((mem8[ROUND_COUNTER] & ROUND_BIT1) === 0) mem8[HUNTER_SPAWN_FLIP_FLAG] = 0x01;
}
