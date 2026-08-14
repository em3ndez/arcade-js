// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateFrogObject — activate the frog object, and in a two-player game seed its two 16-bit timers.
 *
 * Marks the frog object active and clears its two sub-fields; only when the play flag holds 2 does it
 * seed the pair of 16-bit timers.
 * LIVE-OUT: memory-only.
 */
import { loc_8044, loc_8045, loc_8047, PLAY_FLAG, loc_83d2, loc_83da } from "./names.js";

const TWO_PLAYER = 2;
const TIMER_INIT = 64;

export function activateFrogObject(m) {
  const { mem8, mem16 } = m;
  mem8[loc_8044] = 1;
  mem8[loc_8045] = 0;
  mem8[loc_8047] = 0;
  if (mem8[PLAY_FLAG] !== TWO_PLAYER) return;
  mem16[loc_83d2] = TIMER_INIT;
  mem16[loc_83da] = TIMER_INIT;
}
