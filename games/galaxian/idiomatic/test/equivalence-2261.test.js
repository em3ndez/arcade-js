// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2261 — memory-equivalent to the frozen oracle at ROM 0x2261 (dissolves its per-digit call of the
 * BCD-digit painter into a direct idiomatic call). It paints three packed-BCD bytes (walked downward from
 * the source pointer in DE) as six tiles into the cursor (IX), high nibble then low, stepping the cursor up
 * one row (-0x20) per digit with leading-zero blanking (budget 4). The live-outs are the six VIDEORAM tile
 * writes (0x5000-0x53ff), all in the state dump, so EQUAL is asserted on ramDiff. Teeth: a no-op and two
 * cell scribbles (a blanked leading zero, and a significant digit). The return-stack window is masked.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_2261 as cand } from "../loc_2261.js";
import { loc_2261 as oracle } from "../../translated/loc_2261.js";

const SOURCE = 0x4140;   // three BCD bytes read downward: 0x4140, 0x413f, 0x413e
const DEST = 0x5381;     // VIDEORAM cursor (a real digit-field origin), stepping up -0x20 per digit
const BLANK_TILE = 0x10; // 0x80 + 0x90 wraps (mod 256) to the blank tile
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// bytes 0x00,0x05,0x99 -> digits 0,0,0,5,9,9: exercises blanking, the first-significant stop, plain digits.
const entry = () => craft((mem, m) => {
  m.push16(0x9999);
  m.regs.de = SOURCE;
  m.regs.ix = DEST;
  mem[SOURCE] = 0x00; mem[SOURCE - 1] = 0x05; mem[SOURCE - 2] = 0x99;
  for (let i = 0; i < 6; i++) mem[(DEST - i * 0x20) & 0xffff] = 0xee; // sentinels in the six target cells
});

test("EQUAL (crafted): loc_2261 == oracle paints six BCD tiles with leading-zero blanking", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_2261 diverged on the tile writes");
  // positive control: leading zeros blanked, then the '5' and '9' glyphs (digit + 0x90).
  const a = entry(); oracle(a);
  assert.equal(a.mem8[DEST], BLANK_TILE, "positive control: first leading zero blanked");
  assert.equal(a.mem8[(DEST - 3 * 0x20) & 0xffff], 0x90 + 5, "positive control: first significant digit '5'");
  assert.equal(a.mem8[(DEST - 4 * 0x20) & 0xffff], 0x90 + 9, "positive control: digit '9'");
  console.log("  EQUAL: loc_2261 == oracle (RAM), six tiles, blanking then 5,9,9");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribbleBlank = (m) => { cand(m); m.mem8[DEST] ^= 0xff; };
  const scribbleDigit = (m) => { cand(m); m.mem8[(DEST - 4 * 0x20) & 0xffff] ^= 0xff; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, scribbleBlank, entry()), "the blanked-cell scribble twin escaped");
  assert.ok(ramDiff(oracle, scribbleDigit, entry()), "the digit-cell scribble twin escaped");
  console.log("  TEETH: no-op, blanked-cell scribble, digit-cell scribble all caught");
});
