// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1218 — crafted-entry equivalence vs the frozen RNG-based scaler.
 * Live-out is BOTH register A (the scaled value) and RAM: the routine advances RNG_SEED (0x401e) via the
 * PRNG step. A post-attract seed is cloned; the dividend (A), divisor (D) and RNG_SEED are poked and a
 * return laid. EQUAL asserts ramDiff==null (the RNG advance matches) AND register A across several inputs
 * incl. the >0x7f clamp path; a non-vacuous control checks the oracle really advances RNG and sets A.
 * Teeth compare on A (with RNG advanced identically): no-op, dropped +6, wrong mask, no clamp, dropped
 * quotient all escape.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { loc_1218 as cand } from "../loc_1218.js";
import { loc_1218 as oracle } from "../../translated/loc_1218.js";
import { loc_0048 } from "../loc_0048.js";
import { advanceRandomSeed as loc_003c } from "../advanceRandomSeed.js";

const RNG_SEED = 0x401e;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Dividend in A, divisor in D, RNG_SEED poked, return seated.
function entry(dividend, divisor, seed) {
  return craft((mem, m) => {
    m.push16(0x9999);
    m.regs.a = dividend;
    m.regs.d = divisor;
    mem[RNG_SEED] = seed;
  });
}

// Live-out = RAM (RNG advance) AND register A (the scaled value).
function aDiff(twin, e) {
  const ram = ramDiff(oracle, twin, e);
  if (ram) return `RAM ${ram}`;
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.a !== b.regs.a) return `A: ${a.regs.a} vs ${b.regs.a}`;
  return null;
}

// (dividend, divisor, seed, expected A, expected RNG') -- verified against the frozen oracle.
const VECTORS = [
  [0x40, 0x08, 0x37, 0x19, 0x14],
  [0x40, 0x08, 0x80, 0x06, 0x81],
  [0xff, 0x02, 0x01, 0x0b, 0x06],
  [0x00, 0x05, 0xff, 0x41, 0xfc],
  [0x00, 0x01, 0x06, 0x7f, 0x1f], // sum > 0x7f -> clamp
];

test("EQUAL (crafted): loc_1218 == oracle on A and the RNG advance", { skip }, () => {
  for (const [dv, ds, seed] of VECTORS) {
    assert.equal(aDiff(cand, entry(dv, ds, seed)), null,
      `diverged at 0x${dv.toString(16)}/0x${ds.toString(16)} seed 0x${seed.toString(16)}`);
  }
  // Non-vacuous: the oracle really advances RNG_SEED and sets A to the expected value.
  for (const [dv, ds, seed, expA, expRng] of VECTORS) {
    const a = entry(dv, ds, seed); oracle(a);
    assert.equal(a.regs.a, expA, `control: A for 0x${dv.toString(16)}/0x${ds.toString(16)} seed 0x${seed.toString(16)}`);
    assert.equal(a.mem8[RNG_SEED], expRng, `control: RNG' for seed 0x${seed.toString(16)}`);
  }
  console.log("  EQUAL: loc_1218 == oracle on A + RNG advance, incl. the 0x7f clamp");
});

test("TEETH: broken twins are caught (A, RNG advanced identically)", { skip }, () => {
  const noOp = () => {}; // never advances RNG and never sets A
  const droppedFloor = (m) => { const q = loc_0048(m, m.regs.a, m.regs.d); const j = loc_003c(m) & 0x1f; const s = (j + q) & 0xff; m.regs.a = s & 0x80 ? 0x7f : s; };
  const wrongMask = (m) => { const q = loc_0048(m, m.regs.a, m.regs.d); const j = loc_003c(m) & 0x0f; const s = (j + q + 6) & 0xff; m.regs.a = s & 0x80 ? 0x7f : s; };
  const noClamp = (m) => { const q = loc_0048(m, m.regs.a, m.regs.d); const j = loc_003c(m) & 0x1f; m.regs.a = (j + q + 6) & 0xff; };
  const dropQuotient = (m) => { loc_0048(m, m.regs.a, m.regs.d); const j = loc_003c(m) & 0x1f; const s = (j + 6) & 0xff; m.regs.a = s & 0x80 ? 0x7f : s; };

  assert.ok(aDiff(noOp, entry(0x40, 0x08, 0x37)), "no-op twin escaped");
  assert.ok(aDiff(droppedFloor, entry(0x40, 0x08, 0x37)), "dropped-+6 twin escaped");
  assert.ok(aDiff(wrongMask, entry(0x40, 0x08, 0x37)), "wrong-mask twin escaped");
  assert.ok(aDiff(noClamp, entry(0x00, 0x01, 0x06)), "no-clamp twin escaped");
  assert.ok(aDiff(dropQuotient, entry(0xff, 0x02, 0x01)), "dropped-quotient twin escaped");
  console.log("  TEETH: no-op, dropped +6, wrong mask, no clamp, dropped quotient all caught");
});
