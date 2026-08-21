// SPDX-License-Identifier: GPL-3.0-only
import {
  GAME_ACTIVE_FLAG,
  ACTIVE_PLAYER,
  PLAY_TIMER_GATE_P1,
  PLAY_TIMER_GATE_P2,
  PLAY_TIMER_BCD_P1,
  PLAY_TIMER_BCD_P2,
} from "./names.js";
/**
 * loc_7912 — tick the active player's BCD play-timer. Bails when the game is inactive, then selects
 * that player's gate/timer pair and bails when the gate byte is set. The timer's base byte is a frame
 * sub-counter that rolls at 0x3b or 0x3c (the extra frame chosen by bit0 of the seconds byte); on the
 * roll it clears and BCD-carries the seconds digit, then the minutes digit — each digit rolls its low
 * nibble at 0x0a and its high nibble at 0x60.
 *
 * LIVE-OUT: none — writes only the selected timer cells; the caller consumes no register or flag.
 */
export function loc_7912(m) {
  const { mem8 } = m;
  if (mem8[GAME_ACTIVE_FLAG] === 0) return; // game inactive

  const player1 = mem8[ACTIVE_PLAYER] === 0;
  const gate = player1 ? PLAY_TIMER_GATE_P1 : PLAY_TIMER_GATE_P2;
  const timer = player1 ? PLAY_TIMER_BCD_P1 : PLAY_TIMER_BCD_P2;
  if (mem8[gate] !== 0) return; // gate set: skip this pair

  const frameLimit = mem8[timer + 1] & 0x01 ? 0x3c : 0x3b;
  if (mem8[timer] !== frameLimit) {
    mem8[timer] = mem8[timer] + 1; // below the limit: advance the sub-counter (mem8 truncates to 8 bits)
    return;
  }
  mem8[timer] = 0x00; // at the limit: roll the frame sub-counter

  // Carry into the seconds digit.
  let digit = timer + 1;
  let v = (mem8[digit] + 1) & 0xff;
  if ((v & 0x0f) !== 0x0a) {
    mem8[digit] = v;
    return;
  }
  v = (v & 0xf0) + 0x10; // low nibble overflowed: carry into the high nibble
  if (v !== 0x60) {
    mem8[digit] = v;
    return;
  }

  // Seconds reached 60: clear and carry into the minutes digit.
  mem8[digit] = 0x00;
  digit = timer + 2;
  v = (mem8[digit] + 1) & 0xff;
  if ((v & 0x0f) !== 0x0a) {
    mem8[digit] = v;
    return;
  }
  mem8[digit] = (v & 0xf0) + 0x10; // minutes low nibble overflowed: carry into its high nibble
}
