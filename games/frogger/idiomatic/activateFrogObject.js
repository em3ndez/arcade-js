// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateFrogObject — activate the frog object, and in a two-player game seed its two 16-bit timers.
 *
 * Marks the frog object active and clears its two sub-fields; only when the play flag holds 2 does it
 * seed the pair of 16-bit timers.
 * LIVE-OUT: memory-only.
 */
import { FROG_X, FROG_SPRITE_CODE, FROG_Y, PLAY_FLAG, FROG_TIMER_A, FROG_TIMER_B } from "./names.js";

const TWO_PLAYER = 2;
const TIMER_INIT = 64;

export function activateFrogObject(m) {
  const { mem8, mem16 } = m;
  mem8[FROG_X] = 1;
  mem8[FROG_SPRITE_CODE] = 0;
  mem8[FROG_Y] = 0;
  if (mem8[PLAY_FLAG] !== TWO_PLAYER) return;
  mem16[FROG_TIMER_A] = TIMER_INIT;
  mem16[FROG_TIMER_B] = TIMER_INIT;
}
