// SPDX-License-Identifier: GPL-3.0-only
import { SCORE_ADD_PENDING, SAUCER_SCORE_KEY_PTR, SAUCER_SCORE_KEY_TABLE, SAUCER_SCORE_SPRITE_TABLE, loc_2087, SCORE_ADD_VALUE } from "./names.js";
import { resolveSpriteScreenAddr } from "./resolveSpriteScreenAddr.js";
import { drawThreeSprites } from "./drawThreeSprites.js";

// On the mystery ship's destruction: raise the score-add flag, match its value key in the type table, copy
// the parallel sprite-id entry into the sprite record, store key*16 as the score value, then draw its sprite.
export function awardSaucerScore(m) {
  m.mem8[SCORE_ADD_PENDING] = 1;
  const key = m.mem8[m.mem16[SAUCER_SCORE_KEY_PTR]];
  let entry = SAUCER_SCORE_SPRITE_TABLE;
  let probe = SAUCER_SCORE_KEY_TABLE;
  let count = 0x04;
  while (m.mem8[probe] !== key) {
    entry += 1;
    probe += 1;
    count -= 1;
    if (count === 0) break;
  }
  m.mem8[loc_2087] = m.mem8[entry];
  m.mem16[SCORE_ADD_VALUE] = key << 4;
  resolveSpriteScreenAddr(m);
  return drawThreeSprites(m);
}
