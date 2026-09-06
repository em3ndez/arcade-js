// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c5d — memory-equivalent to the frozen oracle at ROM 0x1c5d. Input-scan step: folds the two input
 * bytes handed in via B (IN0) and C (IN1); if their shared bits 2-3 are set it seeds control byte 0x41df=6,
 * then it always falls through into the input-flag/column-draw link (armInputFlagAndDrawInputColumns), which
 * itself tail-delegates to the input-text/screen-fill init. B and C are consumed incoming registers and pass
 * through unchanged; the caller reads no register back, so the control-byte write and every delegate effect
 * land in work RAM / VRAM and ramDiff is the live-out check. Teeth: no-op, a seed-only twin (drops the
 * delegate), and an always-seed twin (ignores the bit gate). Plus an SP-seam tooth on the set and clear
 * paths; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { requestSound6AndContinueInputScan as cand } from "../requestSound6AndContinueInputScan.js";
import { loc_1c5d as oracle } from "../../translated/loc_1c5d.js";
import { armInputFlagAndDrawInputColumns } from "../armInputFlagAndDrawInputColumns.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CTRL = 0x41df; // control byte seeded to 6 when bits 2-3 fold set

// Seat SP, seed the branch registers B/C, and give the delegate chain a deterministic input state (IN0 bit
// 6 clear -> the screen-fill init runs its full body, so a dropped delegate is observable in RAM).
function seed(regB, regC) {
  return craft((mem, mm) => {
    mm.push16(0x9999);
    mm.regs.b = regB; mm.regs.c = regC;
    mm.io.inputAssert = null;
    mm.io.in0 = 0x00; mm.io.in1 = 0xc0; mm.io.in2 = 0x00;
    mem[CTRL] = 0;
  });
}
const setViaB = () => seed(0x04, 0x00); // bit 2 via IN0
const setViaC = () => seed(0x00, 0x08); // bit 3 via IN1 (exercises the OR fold)
const clear = () => seed(0x00, 0x00);   // neither bit set -> skip the seed

test("EQUAL (crafted): loc_1c5d == oracle on the set (B/C) and clear folds (RAM)", { skip }, () => {
  for (const [name, e] of [["setB", setViaB], ["setC", setViaC], ["clear", clear]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_1c5d diverged on the ${name} path`);
  }
  const b = setViaB(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[CTRL], 6, "control: bits 2-3 via B did not seed the control byte");
  const c = setViaC(); c.routines = STUBS; oracle(c);
  assert.equal(c.mem8[CTRL], 6, "control: bits 2-3 via C did not seed the control byte");
  const z = clear(); z.routines = STUBS; oracle(z);
  assert.equal(z.mem8[CTRL], 0, "control: clear fold seeded the control byte");
  console.log("  EQUAL: loc_1c5d == oracle (RAM): set-via-B, set-via-C, clear + delegate fall-through");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const seedOnly = (m, in0 = m.regs.b, in1 = m.regs.c) => {                      // drops the delegate
    if ((in0 | in1) & 0x0c) m.mem8[CTRL] = 6;
  };
  const alwaysSeed = (m, in0 = m.regs.b, in1 = m.regs.c) => {                    // ignores the bit gate
    m.mem8[CTRL] = 6; return armInputFlagAndDrawInputColumns(m, in0, in1);
  };
  assert.ok(ramDiff(oracle, noOp, setViaB()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, seedOnly, setViaB()), "the seed-only twin escaped (delegate)");
  assert.ok(ramDiff(oracle, alwaysSeed, clear()), "the always-seed twin escaped (gate)");
  console.log("  TEETH: no-op, seed-only, always-seed all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["set", setViaB], ["clear", clear]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x1c5d, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x1c5d, setViaB());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on set + clear; stack-adrift mutant refused");
});
