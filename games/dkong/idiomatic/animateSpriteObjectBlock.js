// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSpriteObjectBlock — advance one animation frame of the ten-record sprite-object block,
 * once every eight calls.
 *
 * Every invocation bumps a private 1-in-8 phase counter; on seven of eight calls it returns right
 * away, so the animation only steps on the eighth. When it does step, it edits the ten 4-byte
 * hardware sprite records of SPRITE_OBJ_BLOCK — each record holding X, tile code, attribute and Y:
 *
 *   1. Scroll the whole group up 4 pixels — add −4 to the Y byte of all ten records, through the
 *      shared column-add. That call also leaves the record stride set to 4, which is what the two
 *      code-flip calls below need.
 *   2. Flip and animate four of the records — exclusive-or 0x81 (bit 7 = horizontal flip, bit 0 =
 *      the tile's low bit) into the code byte of records 0 and 1, and again of records 5 and 6,
 *      through the strided pair-XOR.
 *   3. Randomly flip record 9 — stir the pseudo-random seed and exclusive-or bit 7 of the fresh
 *      seed into record 9's code byte, so that sprite's horizontal flip toggles on a coin-flip at
 *      each animation step.
 *
 * The three callees still take their inputs in registers, so this routine stages those and applies
 * the closing random bit-7 toggle itself.
 *
 * LIVE-OUT: memory-only — the phase counter on every call and, on the eighth, the ten Y bytes, the
 * four flipped code bytes, record 9's code byte, and the stirred random seed.
 */
import { SPRITE_OBJ_BLOCK } from "./names.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { xorMaskStridedPair } from "./xorMaskStridedPair.js";
import { stirRandomSeed } from "./stirRandomSeed.js";

const PHASE_COUNTER = 0x62af; // private 1-in-8 animation phase counter; it has no other reader
const B = SPRITE_OBJ_BLOCK; // base of the ten 4-byte sprite records

export function animateSpriteObjectBlock(m) {
  const { regs, mem } = m;

  // Bump the phase counter (with its 8-bit wrap) on EVERY call; run the body only on the eighth,
  // when the low three bits come out zero.
  const phase = (mem.read8(PHASE_COUNTER) + 1) & 0xff;
  mem.write8(PHASE_COUNTER, phase);
  if ((phase & 0x07) !== 0) return; // 7 of every 8 calls stop here

  // 1. Scroll all ten records up 4px: add −4 into each record's Y byte, stride 4. The shared
  //    column-add also leaves the stride set to 4 for the code-flip calls.
  regs.hl = B + 3; // record 0's Y byte
  regs.c = 0xfc; // −4
  addToSpriteObjectColumn(m);

  // 2. Flip/animate records 0,1 then 5,6: XOR 0x81 into their code byte, two bytes at stride 4.
  //    The stride is already 4 from the call above; it is set explicitly here so the load-bearing
  //    value is not a hidden inheritance.
  regs.de = 0x0004;
  regs.c = 0x81; // bit 7 flip | bit 0 tile-LSB
  regs.hl = B + 1; // record 0's code byte (pair: records 0 & 1)
  xorMaskStridedPair(m);
  regs.hl = B + 0x15; // record 5's code byte (pair: records 5 & 6)
  xorMaskStridedPair(m);

  // 3. Random flip of record 9: stir the seed, then XOR bit 7 of the fresh seed into record 9's
  //    code byte.
  stirRandomSeed(m); // leaves the fresh seed in regs.a
  const rec9Code = B + 0x25; // record 9's code byte
  mem.write8(rec9Code, mem.read8(rec9Code) ^ (regs.a & 0x80));
}
