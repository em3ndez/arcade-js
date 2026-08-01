// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusLifeAtThreshold — grant the once-per-player bonus life the first time
 * the running score reaches the operator-set threshold, then refresh the HUD.
 * ROM 0x0350.
 *
 * Called every frame while a game is in progress. A per-player latch
 * (BONUS_LIFE_AWARDED) makes the whole thing a no-op once the life has been
 * granted, so the award happens at most once per player per game.
 *
 * The test compares the current player's score against the DIP-configured
 * threshold, both in thousands: DIP_BONUS_LIFE holds the threshold as a single
 * BCD byte (e.g. 0x15 = 15000), and the score's "thousands" pair is assembled
 * from the two BCD score bytes just above the ones/tens — the thousands digit
 * (high nibble of the middle score byte) and the ten-thousands digit (low nibble
 * of the top score byte) — packed into one byte with ten-thousands in the high
 * nibble and thousands in the low. When that byte is at or above the threshold,
 * the life is awarded: the latch is set, LIVES is bumped, and the lives/level HUD
 * is repainted (passing "one Mario in play", so the marker column shows the new
 * reserve count).
 *
 * The score slot is chosen by the player up now (P1 or P2). Nothing consumes a
 * return value — the caller discards it — so this is void.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0350.test.js.
 * GATE:     crafted-entry — the routine is dispatched every frame in attract but
 *           the score never crosses the threshold there, so real captured
 *           dispatches only cover the no-award path; crafted entries poke the
 *           score / threshold / player / latch identically on both sides to reach
 *           the award path (both HUD arms), the already-awarded early-out, and the
 *           threshold boundary. Reserve (LIVES-1) is kept 0..6 so the HUD repaint's
 *           marker fill stays in mapped video RAM. Teeth: a wrong life increment
 *           and a dropped nibble-swap.
 * LIVE-OUT: memory-only — the caller (the per-frame main loop) discards the result
 *           and overwrites the registers before reading them.
 * NAMES:    BONUS_LIFE_AWARDED (0x622D), CURRENT_PLAYER (0x600D), P1_SCORE (0x60B2),
 *           P2_SCORE (0x60B5), DIP_BONUS_LIFE (0x6021), LIVES (0x6228) — all from
 *           ram.js. The HUD video cells are inside the drawLivesAndLevel callee.
 */

import {
  BONUS_LIFE_AWARDED,
  CURRENT_PLAYER,
  P1_SCORE,
  P2_SCORE,
  DIP_BONUS_LIFE,
  LIVES,
} from "./ram.js";
import { drawLivesAndLevel } from "./drawLivesAndLevel.js"; // ROM 0x06B8

export function awardBonusLifeAtThreshold(m) {
  const { regs, mem } = m;

  // Already granted this player their bonus life — nothing to do.
  if (mem.read8(BONUS_LIFE_AWARDED) !== 0) return;

  // Point at the current player's score. Each score is 3-byte little-endian BCD;
  // the byte one above the base holds the (hundreds, thousands) digit pair, and
  // the next one up holds the (ten-thousands, hundred-thousands) pair.
  const scoreThousandsByte = (mem.read8(CURRENT_PLAYER) === 0 ? P1_SCORE : P2_SCORE) + 1;
  const midPair = mem.read8(scoreThousandsByte);       // hundreds | thousands
  const topPair = mem.read8(scoreThousandsByte + 1);   // ten-thousands | hundred-thousands

  // Assemble the score in thousands as one BCD byte: ten-thousands digit in the
  // high nibble, thousands digit in the low nibble — the value the threshold is
  // quoted in.
  const scoreInThousands = ((topPair & 0x0f) << 4) | ((midPair & 0xf0) >> 4);

  // Below the threshold: no life this frame.
  if (scoreInThousands < mem.read8(DIP_BONUS_LIFE)) return;

  // Award the life: latch it so it happens only once, and bump the life count.
  mem.write8(BONUS_LIFE_AWARDED, 1);
  mem.write8(LIVES, mem.read8(LIVES) + 1);

  // Repaint the lives/level HUD. "One Mario in play" means the marker column shows
  // LIVES-1 reserve markers, so the freshly-earned life appears.
  regs.a = 1;
  drawLivesAndLevel(m);
}
