// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSpriteObjectBlock — advance one animation frame of the ten-record SPRITE_OBJ_BLOCK, once
 * every eight calls. On the eighth: scroll all ten records up 4px (stride left at 4), XOR 0x81 into
 * the code byte of records 0,1 and 5,6, and randomly flip record 9's horizontal-flip bit from a
 * freshly stirred seed.
 *
 * LIVE-OUT: memory-only — the phase counter on every call and, on the eighth, the ten Y bytes, the
 * four flipped code bytes, record 9's code byte, and the stirred random seed.
 */
import { SPRITE_OBJ_BLOCK } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { xorMaskStridedPair } from "./xorMaskStridedPair.js";
import { stirRandomSeed } from "./stirRandomSeed.js";

const PHASE_COUNTER = 0x62af; // private 1-in-8 animation phase counter
const B = SPRITE_OBJ_BLOCK; // base of the ten 4-byte sprite records

export function animateSpriteObjectBlock(m) {
  const { regs, mem8 } = m;

  const phase = (mem8[PHASE_COUNTER] + 1) & 0xff;
  mem8[PHASE_COUNTER] = phase;
  if ((phase & 0x07) !== 0) return; // 7 of every 8 calls stop here

  // Scroll all ten records up 4px, stride 4 (also left set for the code-flip calls).
  regs.hl = B + 3; // record 0's Y byte
  regs.c = 0xfc; // −4
  addToSpriteObjectColumn(m);

  // XOR 0x81 (bit 7 flip | bit 0 tile-LSB) into records 0,1 then 5,6, two bytes at stride 4.
  regs.de = 0x0004;
  regs.c = 0x81;
  regs.hl = B + 1; // records 0 & 1
  xorMaskStridedPair(m);
  regs.hl = B + 0x15; // records 5 & 6
  xorMaskStridedPair(m);

  // Random flip of record 9 from bit 7 of the freshly stirred seed.
  stirRandomSeed(m); // leaves the fresh seed in regs.a
  const rec9Code = B + 0x25;
  mem8[rec9Code] = mem8[rec9Code] ^ (regs.a & 0x80);
}
