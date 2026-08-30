// SPDX-License-Identifier: GPL-3.0-only
import {
  BLINK_COUNTDOWN,
  BLINK_PHASE,
  BLINK_TILE_PAIRS,
  BLINK_TILE_CELL_0,
} from "./names.js";
/**
 * blinkTilePairOnCountdown — a per-frame timer that blinks a pair of on-screen tiles.
 *
 * ROM 0x76af-0x76d3. Grounding: [seen].
 *
 * WHAT IT IS: the tick handler for a slow two-frame blink. It owns two RAM bytes — a frame
 * countdown (BLINK_COUNTDOWN, 0x892a) and a phase byte (BLINK_PHASE, 0x892b) — and, when the
 * countdown expires, swaps the character in two fixed video cells between two appearances.
 *
 * HOW IT TICKS: called once per frame. While the countdown is non-zero it simply decrements
 * it and returns, so nothing changes on screen. On the frame the countdown reaches zero it
 * reloads the countdown to 0x16 (22 frames — the blink period), advances the phase byte by
 * one, and repaints. Because the phase byte is only ever incremented, its low bit alternates
 * 1,0,1,0,... on successive expiries, giving the two-state blink.
 *
 * WHICH APPEARANCE: the phase's low bit picks one of two adjacent 2-byte tile pairs at
 * BLINK_TILE_PAIRS (0x76e6): {0x3f,0x46} at +0 and {0x46,0x3f} at +2. The two cells therefore
 * trade characters each swap — cell A shows 0x3f then 0x46, cell B the reverse — so the pair
 * flickers between two frames of the same little animation.
 *
 * WHERE IT DRAWS: the first byte of the chosen pair goes to BLINK_TILE_CELL_0 (0x8471) and
 * the second to that cell plus 0x40 — two rows further down the video map (0x40 = two row
 * pitches of 0x20). The two blinking cells sit two rows apart in the same column.
 *
 * NOTE: BLINK_PHASE is MULTIPLEXED per the names.js cert — an object-animation path also seeds
 * and uses 0x892a/0x892b as a sprite-frame countdown. This routine implements the blink read
 * of it; that is the [seen] behaviour recorded here.
 *
 * LIVE-OUT: none — memory only (the countdown, the phase byte, and the two video cells).
 */

const COUNTDOWN_RELOAD = 0x16; // 22 frames between blink swaps (the blink period)
const CELL_STRIDE = 0x40; // gap to the second blink cell: two row pitches (2 * 0x20) further down

export function blinkTilePairOnCountdown(m) {
  const { mem8 } = m;

  // While the countdown is still running, just tick it down and leave the screen alone. Most
  // frames take this path — the swap only happens once every COUNTDOWN_RELOAD frames.
  if (mem8[BLINK_COUNTDOWN] !== 0) {
    mem8[BLINK_COUNTDOWN] = mem8[BLINK_COUNTDOWN] - 1; // counting down to the next swap
    return;
  }

  // Expired: restart the countdown and advance the phase. The phase byte is only ever
  // incremented, so its low bit flips 1/0 each expiry — that alternation is the blink state.
  mem8[BLINK_COUNTDOWN] = COUNTDOWN_RELOAD;
  mem8[BLINK_PHASE] = mem8[BLINK_PHASE] + 1; // advance the blink phase

  // Pick which 2-byte tile pair to show from the phase parity: odd phase keeps the first pair
  // (BLINK_TILE_PAIRS+0 = {0x3f,0x46}), even selects the second (+2 = {0x46,0x3f}). The two
  // pairs are mirror images, so the two cells trade characters on every swap.
  const pair = BLINK_TILE_PAIRS + (mem8[BLINK_PHASE] & 0x01 ? 0 : 2); // odd keeps the first pair

  // Repaint the two blinking video cells: pair byte 0 into the anchor cell, pair byte 1 into
  // the cell two rows down (CELL_STRIDE = 0x40). This is the visible half of the swap.
  mem8[BLINK_TILE_CELL_0] = mem8[pair];
  mem8[BLINK_TILE_CELL_0 + CELL_STRIDE] = mem8[pair + 1];
}
