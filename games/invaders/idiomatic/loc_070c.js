// SPDX-License-Identifier: GPL-3.0-only
import { SCORE_ADD_PENDING, loc_208d, loc_1d4c, loc_1d50, loc_2087, SCORE_ADD_VALUE } from "./names.js";
import { resolveSpriteScreenAddr } from "./resolveSpriteScreenAddr.js";
import { drawThreeSprites } from "./drawThreeSprites.js";

// On the mystery ship's destruction: raise the score-add flag, match its value key in the type table, copy
// the parallel sprite-id entry into the sprite record, store key*16 as the score value, then draw its sprite.
export function loc_070c(m) {
  m.mem8[SCORE_ADD_PENDING] = 1;
  const key = m.mem8[m.mem16[loc_208d]];
  let entry = loc_1d50;
  let probe = loc_1d4c;
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
