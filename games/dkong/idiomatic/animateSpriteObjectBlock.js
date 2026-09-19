// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSpriteObjectBlock — advance one animation frame of the ten-record SPRITE_OBJ_BLOCK, once
 * every eighth call: scroll all ten records up 4px, XOR 0x81 into the code byte of records 0,1,5,6,
 * and randomly flip record 9's horizontal-flip bit.
 *
 * LIVE-OUT: memory-only — the phase counter, and on the eighth call the ten Y bytes, four flipped
 * code bytes, record 9's code byte, and the stirred random seed.
 */
import { SPRITE_OBJ_BLOCK, RANDOM } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { xorMaskStridedPair } from "./xorMaskStridedPair.js";
import { stirRandomSeed } from "./stirRandomSeed.js";

const PHASE_COUNTER = 0x62af; // private 1-in-8 animation phase counter
const B = SPRITE_OBJ_BLOCK; // base of the ten 4-byte sprite records

export function animateSpriteObjectBlock(m) {
  const { mem8 } = m;

  const phase = (mem8[PHASE_COUNTER] + 1) & 0xff;
  mem8[PHASE_COUNTER] = phase;
  if ((phase & 0x07) !== 0) return; // 7 of every 8 calls stop here

  addToSpriteObjectColumn(m, B + 3, 0xfc); // scroll every record's Y up 4px

  xorMaskStridedPair(m, 0x81, 0x0004, B + 1); // records 0 & 1
  xorMaskStridedPair(m, 0x81, 0x0004, B + 0x15); // records 5 & 6

  stirRandomSeed(m); // refreshes the pseudo-random seed byte in RANDOM
  const rec9Code = B + 0x25;
  mem8[rec9Code] = mem8[rec9Code] ^ (mem8[RANDOM] & 0x80);
}
