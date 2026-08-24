// SPDX-License-Identifier: GPL-3.0-only
import {
  BLINK_COUNTDOWN,
  BLINK_PHASE,
  BLINK_TILE_PAIRS,
  BLINK_TILE_CELL_0,
} from "./names.js";
/**
 * blinkTilePairOnCountdown — two-phase blink timer. While the countdown is non-zero it decrements and
 * returns. On expiry it reloads the countdown, toggles the phase, and picks one of two
 * 2-byte tile pairs by phase parity, writing the pair into two video cells a fixed stride
 * apart to swap the blinking tiles.
 *
 * LIVE-OUT: none — memory only.
 */

const COUNTDOWN_RELOAD = 0x16; // frames between blink swaps
const CELL_STRIDE = 0x40; // gap from the first blink cell to the second

export function blinkTilePairOnCountdown(m) {
  const { mem8 } = m;

  if (mem8[BLINK_COUNTDOWN] !== 0) {
    mem8[BLINK_COUNTDOWN] = mem8[BLINK_COUNTDOWN] - 1; // counting down to the next swap
    return;
  }
  mem8[BLINK_COUNTDOWN] = COUNTDOWN_RELOAD;
  mem8[BLINK_PHASE] = mem8[BLINK_PHASE] + 1; // toggle the phase

  const pair = BLINK_TILE_PAIRS + (mem8[BLINK_PHASE] & 0x01 ? 0 : 2); // odd keeps the first pair
  mem8[BLINK_TILE_CELL_0] = mem8[pair];
  mem8[BLINK_TILE_CELL_0 + CELL_STRIDE] = mem8[pair + 1];
}
