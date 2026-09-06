// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_11d0 — crafted-entry equivalence vs the frozen slope-to-octant helper.
 * The routine writes no RAM; its sole live-out is register A (the 0-7 octant). A post-attract seed is
 * cloned, the dividend (A) and divisor (D) poked, and a return laid for the oracle's ret. EQUAL asserts
 * ramDiff==null (nothing written) AND register A across octants 0-4 (0-3 from the plain quotient, 4 from
 * the negative-clamp path); a non-vacuous control checks the oracle really sets A to the expected octant.
 * Teeth compare on A: no-op, dropped clamp, wrong shift and wrong clamp-constant all escape.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { computeDirectionOctantFromSlope as cand } from "../computeDirectionOctantFromSlope.js";
import { loc_11d0 as oracle } from "../../translated/loc_11d0.js";
import { divideUnsigned8 } from "../divideUnsigned8.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Dividend in A, divisor in D, return seated.
function entry(dividend, divisor) {
  return craft((mem, m) => {
    m.push16(0x9999);
    m.regs.a = dividend;
    m.regs.d = divisor;
  });
}

// Live-out = register A (the octant); the routine writes no RAM (ramDiff must stay null).
function aDiff(twin, e) {
  const ram = ramDiff(oracle, twin, e);
  if (ram) return `RAM ${ram}`;
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.a !== b.regs.a) return `A: ${a.regs.a} vs ${b.regs.a}`;
  return null;
}

// (dividend, divisor, expected octant) -- octants 0..3 from the quotient, 4 from the negative clamp.
// Verified against the frozen oracle + the real divide (divideUnsigned8).
const VECTORS = [[0x00, 0x04, 0], [0x00, 0x02, 1], [0x02, 0x04, 2], [0x00, 0x01, 3], [0x90, 0x01, 4]];

test("EQUAL (crafted): loc_11d0 == oracle across octants 0-4", { skip }, () => {
  for (const [dv, ds] of VECTORS) {
    assert.equal(aDiff(cand, entry(dv, ds)), null,
      `diverged at dividend=0x${dv.toString(16)} divisor=0x${ds.toString(16)}`);
  }
  // Non-vacuous: the oracle really sets A to the expected octant (and it varies across the clamp boundary).
  for (const [dv, ds, oct] of VECTORS) {
    const a = entry(dv, ds); oracle(a);
    assert.equal(a.regs.a, oct, `control: octant for 0x${dv.toString(16)}/0x${ds.toString(16)}`);
  }
  console.log("  EQUAL: loc_11d0 == oracle on A (octant) 0..4, incl. negative-clamp path");
});

test("TEETH: broken twins are caught on register A", { skip }, () => {
  const noOp = () => {};
  // Skips the negative clamp: a top-bit-set quotient leaks its high bits instead of clamping to 0x80.
  const noClamp = (m) => { const q = divideUnsigned8(m, m.regs.a, m.regs.d); m.regs.a = (q >> 5) & 0x07; };
  // Wrong shift amount (>>4 instead of >>5).
  const wrongShift = (m) => { const q = divideUnsigned8(m, m.regs.a, m.regs.d); const c = q & 0x80 ? 0x80 : q; m.regs.a = (c >> 4) & 0x07; };
  // Wrong clamp constant (0x00 instead of 0x80) -- the drafter's mutation.
  const wrongClamp = (m) => { const q = divideUnsigned8(m, m.regs.a, m.regs.d); const c = q & 0x80 ? 0x00 : q; m.regs.a = (c >> 5) & 0x07; };

  assert.ok(aDiff(noOp, entry(0x90, 0x01)), "no-op twin escaped");
  assert.ok(aDiff(noClamp, entry(0x90, 0x01)), "no-clamp twin escaped");
  assert.ok(aDiff(wrongShift, entry(0x00, 0x02)), "wrong-shift twin escaped");
  assert.ok(aDiff(wrongClamp, entry(0x90, 0x01)), "wrong-clamp-constant twin escaped");
  console.log("  TEETH: no-op, no-clamp, wrong-shift, wrong-clamp all caught on A");
});
