// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2104 — crafted-entry equivalence vs the frozen timer-bias tail at ROM 0x2104. This leaf writes no
 * RAM; its only live-out is register B. Below the range limit it folds B to a 2-bit variant index using
 * the frame counter (0x425f) and a carry derived from the counter's low nibble; at/above the limit it
 * saturates B to the out-of-range marker. So EQUAL is asserted on register B (RAM must stay untouched on
 * both sides, stack window masked by ramDiff). Paths: fold with carry, fold without carry, saturate.
 * Teeth: no-op, off-by-one, and zero twins each leave a wrong B.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { computeTileVariantFromValueAndTimer as cand } from "../computeTileVariantFromValueAndTimer.js";
import { loc_2104 as oracle } from "../../translated/loc_2104.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const COUNTER = 0x425f; // frame counter the fold nibble-swaps

// carry set: counter low nibble (0) < B low nibble (5) -> B = (swap(0x30)=0x03 + 5 + 0xff) & 3 = 3.
const foldCarry = () => craft((mem, mm) => { mm.regs.b = 5; mem[COUNTER] = 0x30; mm.push16(0x9999); });
// carry clear: counter low nibble (5) == B low nibble (5) -> B = (swap(0x35)=0x53 + 5 + 0) & 3 = 0.
const foldNoCarry = () => craft((mem, mm) => { mm.regs.b = 5; mem[COUNTER] = 0x35; mm.push16(0x9999); });
// out of range: B >= 112 -> saturate to 128.
const saturate = () => craft((mem, mm) => { mm.regs.b = 112; mem[COUNTER] = 0x35; mm.push16(0x9999); });

// Live-out is register B: RAM must match (stack masked) AND B must match.
function bDiff(twin, e) {
  const ram = ramDiff(oracle, twin, e);
  if (ram) return `RAM ${ram}`;
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.b !== b.regs.b) return `B: ${a.regs.b} vs ${b.regs.b}`;
  return null;
}

test("EQUAL (crafted): loc_2104 == oracle folds B with and without carry", { skip }, () => {
  assert.equal(bDiff(cand, foldCarry()), null, "fold-with-carry diverged");
  assert.equal(bDiff(cand, foldNoCarry()), null, "fold-without-carry diverged");
  const a = foldCarry(); a.routines = STUBS; oracle(a);
  assert.equal(a.regs.b, 3, "positive control: fold-with-carry did not produce 3");
  const b = foldNoCarry(); b.routines = STUBS; oracle(b);
  assert.equal(b.regs.b, 0, "positive control: fold-without-carry did not produce 0");
  console.log("  EQUAL: loc_2104 == oracle on B — folded 5 -> 3 (carry) / 0 (no carry)");
});

test("EQUAL (crafted): loc_2104 == oracle saturates B out of range", { skip }, () => {
  assert.equal(bDiff(cand, saturate()), null, "saturate diverged");
  const a = saturate(); a.routines = STUBS; oracle(a);
  assert.equal(a.regs.b, 128, "positive control: oracle did not saturate B to 128");
  console.log("  EQUAL: loc_2104 == oracle on B — saturated 112 -> 128");
});

test("TEETH: broken twins are caught on register B", { skip }, () => {
  const noOp = () => {};
  const offByOne = (m) => { m.regs.b = (m.regs.b + 1) & 0xff; };
  const zero = (m) => { m.regs.b = 0; };
  assert.ok(bDiff(noOp, foldCarry()), "no-op twin escaped");
  assert.ok(bDiff(offByOne, foldCarry()), "off-by-one twin escaped");
  assert.ok(bDiff(zero, saturate()), "zero twin escaped");
  console.log("  TEETH: no-op, off-by-one, zero all caught on B");
});
