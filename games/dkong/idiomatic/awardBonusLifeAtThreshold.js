// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusLifeAtThreshold — grant the once-per-player bonus life the first time
 * the running score reaches the operator-set threshold, then refresh the HUD.
 *
 * Called every frame while a game is in progress. A per-player latch
 * (BONUS_LIFE_AWARDED) makes the whole thing a no-op once the life has been
 * granted, so the award happens at most once per player per game.
 *
 * The threshold test compares the current player's score against the
 * operator-configured threshold, both in thousands: DIP_BONUS_LIFE holds the
 * threshold as a single BCD byte (0x15 means 15000), and the score's "thousands"
 * pair is assembled from the two BCD score bytes just above the ones/tens — the
 * thousands digit (high nibble of the middle score byte) and the ten-thousands
 * digit (low nibble of the top score byte) — packed into one byte with
 * ten-thousands in the high nibble and thousands in the low. When that byte is at
 * or above the threshold, the life is awarded: the latch is set, LIVES is bumped,
 * and the lives/level HUD is repainted (told "one Mario in play", so the marker
 * column shows the new reserve count).
 *
 * The score slot is chosen by the player up now (P1 or P2).
 *
 * LIVE-OUT: memory-only.
 */

import {
  BONUS_LIFE_AWARDED,
  CURRENT_PLAYER,
  P1_SCORE,
  P2_SCORE,
  DIP_BONUS_LIFE,
  LIVES,
} from "./names.js";
import { drawLivesAndLevel } from "./drawLivesAndLevel.js";

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
