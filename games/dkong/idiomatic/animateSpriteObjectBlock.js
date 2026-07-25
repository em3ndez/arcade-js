// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateSpriteObjectBlock — advance one animation frame of the ten-record
 * sprite-object block, once every eight calls.  ROM 0x306f.
 *
 * Every invocation bumps a private 1-in-8 phase counter at 0x62AF; on seven of
 * eight calls it returns immediately, so the animation only steps on the eighth.
 * When it does step, it edits the SPRITE_OBJ_BLOCK (0x6908–0x692F, ten 4-byte
 * hardware sprite records: +0 X, +1 code, +2 attr, +3 Y):
 *
 *   1. Scroll the whole group up 4px — add −4 (0xFC) to the Y byte (+3) of all
 *      ten records, via the rst-0x38 vector addToSpriteObjectColumn (stride 4,
 *      count 10, HL = 0x690b). That vector also fixes DE = 4 as a side effect,
 *      which the two XOR calls below inherit (the oracle never reloads DE).
 *   2. Flip/animate four of the records — XOR 0x81 (bit 7 = horizontal flip,
 *      bit 0 = tile LSB) into the code byte (+1) of records 0 & 1 (0x6909, stride
 *      4) and records 5 & 6 (0x691d, stride 4), via xorMaskStridedPair.
 *   3. Randomly flip record 9 — stir the pseudo-random seed (stirRandomSeed) and
 *      XOR bit 7 of the fresh seed into record 9's code byte (0x692d), so that
 *      sprite's horizontal-flip toggles on a coin-flip each animation step.
 *
 * The three callees are the already-decompiled idiomatic primitives; this routine
 * only marshals HL/C/DE for them (they still use the Z80 register ABI) and applies
 * the closing random bit-7 toggle itself.
 *
 * REACHABILITY: unwired — attract dispatches 0x306f ZERO times (measured over 2000
 * frames); its three callers (ROM 0x0AE8/0x1732/0x1757) are in the untranslated
 * subtree, and the body runs 1-in-8 even then. Validated on CRAFTED entries built
 * from real captured board-setup RAM (the 0x6908 block populated), sweeping the
 * phase counter across all 256 values to drive BOTH arms and the 8-bit wrap.
 *
 * Memory-equivalent to the frozen oracle — equivalence-306f.test.js.
 * GATE:     crafted-entry — real captured RAM (hooked at the sibling 0x003d during
 *           board setup) with the phase counter 0x62AF swept over all 256 values,
 *           plus seeds forcing the random bit-7 toggle to actually fire. Compared
 *           on RAM (−STACK_SCRATCH) + pc + SP. Teeth: a drop-the-throttle twin
 *           (body every call) and a store-instead-of-XOR twin on 0x692d.
 * LIVE-OUT: memory-only — the phase counter (0x62AF, every call) and, on the eighth
 *           call, the ten Y bytes + four flipped code bytes + record-9 code +
 *           the stirred seed (0x6018). The oracle's residual A/flags (the `and 0x07`
 *           result on the early return, the `xor (hl)` result on the full return)
 *           are dead ABI — the untranslated callers were not traced, so they are
 *           treated as dead and backstopped by the whole-machine memory gate; the
 *           harness supplies the `ret` to line pc/SP up with the oracle.
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908) — ram.js. 0x62AF stays hex: a private phase
 *           counter with no other reader (ram.js leaves it unnamed).
 */
import { SPRITE_OBJ_BLOCK } from "../optimized/ram.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { xorMaskStridedPair } from "./xorMaskStridedPair.js"; // ROM 0x3096
import { stirRandomSeed } from "./stirRandomSeed.js"; // ROM 0x0057

const PHASE_COUNTER = 0x62af; // private 1-in-8 animation phase counter (unnamed in ram.js)
const B = SPRITE_OBJ_BLOCK; // 0x6908 — base of the ten 4-byte sprite records

export function animateSpriteObjectBlock(m) {
  const { regs, mem } = m;

  // `inc (hl) / and 0x07 / ret nz` — bump the phase counter (8-bit wrap) EVERY
  // call; run the body only on the eighth (when the low three bits are 0).
  const phase = (mem.read8(PHASE_COUNTER) + 1) & 0xff;
  mem.write8(PHASE_COUNTER, phase);
  if ((phase & 0x07) !== 0) return; // 7 of every 8 calls stop here

  // 1. Scroll all ten records up 4px: add C = 0xFC (−4) into each record's Y byte
  //    (+3), stride 4. The rst-0x38 vector also sets DE = 4 for the XOR calls.
  regs.hl = B + 3; // 0x690b — record 0's Y byte
  regs.c = 0xfc; // −4
  addToSpriteObjectColumn(m);

  // 2. Flip/animate records 0,1 then 5,6: XOR 0x81 into their code byte (+1),
  //    two bytes at stride DE = 4. DE was fixed to 4 by the rst above; set it
  //    explicitly here so the load-bearing stride is not a hidden inheritance.
  regs.de = 0x0004;
  regs.c = 0x81; // bit 7 flip | bit 0 tile-LSB
  regs.hl = B + 1; // 0x6909 — record 0's code byte (pair: records 0 & 1)
  xorMaskStridedPair(m);
  regs.hl = B + 0x15; // 0x691d — record 5's code byte (pair: records 5 & 6)
  xorMaskStridedPair(m);

  // 3. Random flip of record 9: stir the RNG seed, then XOR bit 7 of the fresh
  //    seed into record 9's code byte — `call 0x0057 / and 0x80 / xor (hl) / ld (hl),a`.
  stirRandomSeed(m); // leaves the fresh seed in regs.a
  const rec9Code = B + 0x25; // 0x692d — record 9's code byte
  mem.write8(rec9Code, mem.read8(rec9Code) ^ (regs.a & 0x80));
}
