// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0988 — memory-equivalent to the frozen oracle at ROM 0x0988.
 * Loads the swept formation word's low byte, negates it (two's-complement) and broadcasts that byte
 * across the nine stride-2 work-RAM cells at 0x4028. Live-out is RAM only. The seed paints the nine
 * cells with 0 so the write is observable and picks a low byte whose negation is nonzero.
 * Teeth: no-op, un-negated (raw low byte), and wrong-cell twins. Positive control: the negated fill.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_0988 as cand } from "../loc_0988.js";
import { loc_0988 as oracle } from "../../translated/loc_0988.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SWEEP_WORD = 0x420e;   // low byte read; high byte ignored
const BASE = 0x4028;
const CELL_COUNT = 9;
const STRIDE = 2;
const LOW = 0x03;
const EXPECT = (-LOW) & 0xff; // 0xfd

const seed = () => craft((mem8, m) => {
  for (let i = 0; i < CELL_COUNT; i++) mem8[BASE + i * STRIDE] = 0x00;
  mem8[SWEEP_WORD] = LOW;
  mem8[SWEEP_WORD + 1] = 0x12; // high byte -- must not affect the result
  m.push16(0x9999);
});

test("EQUAL (crafted): loc_0988 == oracle broadcasts the negated low byte", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seed()), null, "loc_0988 diverged from the oracle");

  const a = seed(); oracle(a);
  assert.equal(a.mem8[BASE], EXPECT, "positive control: first cell holds the negated low byte");
  assert.equal(a.mem8[BASE + (CELL_COUNT - 1) * STRIDE], EXPECT, "positive control: last cell filled too");
  console.log(`  EQUAL: low 0x${LOW.toString(16)} -> fill 0x${EXPECT.toString(16)} across ${CELL_COUNT} cells`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const unNegated = (m) => { for (let i = 0; i < CELL_COUNT; i++) m.mem8[BASE + i * STRIDE] = m.mem8[SWEEP_WORD]; };
  const wrongCell = (m) => { for (let i = 0; i < CELL_COUNT; i++) m.mem8[BASE + i * STRIDE] = EXPECT; m.mem8[BASE + 1] = 0x55; };
  assert.ok(ramDiff(oracle, noOp, seed()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, unNegated, seed()), "the un-negated twin escaped");
  assert.ok(ramDiff(oracle, wrongCell, seed()), "the wrong-cell twin escaped");
  console.log("  TEETH: no-op, un-negated, wrong-cell all caught");
});
