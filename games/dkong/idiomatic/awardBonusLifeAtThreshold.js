// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusLifeAtThreshold — grant the once-per-player bonus life the first time the running
 * score reaches the operator-set threshold, then refresh the HUD. A per-player latch makes it a
 * no-op once granted.
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
  const { regs, mem8 } = m;

  if (mem8[BONUS_LIFE_AWARDED] !== 0) return;

  const scoreThousandsByte = (mem8[CURRENT_PLAYER] === 0 ? P1_SCORE : P2_SCORE) + 1;
  const midPair = mem8[scoreThousandsByte];       // hundreds | thousands
  const topPair = mem8[scoreThousandsByte + 1];   // ten-thousands | hundred-thousands

  // Score in thousands as one BCD byte, matching DIP_BONUS_LIFE: ten-thousands in the high
  // nibble, thousands in the low.
  const scoreInThousands = ((topPair & 0x0f) << 4) | ((midPair & 0xf0) >> 4);

  if (scoreInThousands < mem8[DIP_BONUS_LIFE]) return;

  mem8[BONUS_LIFE_AWARDED] = 1;
  mem8[LIVES] = mem8[LIVES] + 1;

  // "One Mario in play" so the marker column shows the freshly-earned reserve life.
  regs.a = 1;
  drawLivesAndLevel(m);
}
