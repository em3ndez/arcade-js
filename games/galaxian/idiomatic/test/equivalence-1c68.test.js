// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c68 — memory-equivalent to the frozen oracle at ROM 0x1c68. Continues the input scan: it folds the
 * two input bytes handed in via B (IN0) and C (IN1); if their shared bit 4 is set it raises the companion
 * control byte 0x41cc=1, then it always falls through into the input-text/screen-fill init at 0x1c73. The
 * control-byte write and every effect of the delegate land in work RAM / VRAM, so ramDiff is the live-out
 * check; the tail-dispatch caller reads no registers back. B and C are consumed incoming registers, seeded
 * per entry. Teeth: no-op, a control-only twin (drops the delegate), and an always-write twin (ignores the
 * bit-4 gate). Plus an SP-seam tooth on the set and clear paths; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { armInputFlagAndDrawInputColumns as cand } from "../armInputFlagAndDrawInputColumns.js";
import { loc_1c68 as oracle } from "../../translated/loc_1c68.js";
import { drawInputTextColumnsAndSeedScreenFill } from "../drawInputTextColumnsAndSeedScreenFill.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CTRL = 0x41cc; // companion control byte raised when bit 4 folds set

// Seat SP, seed the branch registers B/C, and give the delegate a deterministic input state (IN0 bit 6
// clear -> the delegate runs its full init, so a dropped delegate is observable in RAM).
function seed(regB, regC) {
  return craft((mem, mm) => {
    mm.push16(0x9999);
    mm.regs.b = regB; mm.regs.c = regC;
    mm.io.inputAssert = null;
    mm.io.in0 = 0x00; mm.io.in1 = 0xc0; mm.io.in2 = 0x00;
    mem[CTRL] = 0;
  });
}
const setViaBEntry = () => seed(0x10, 0x00); // bit 4 via IN0
const setViaCEntry = () => seed(0x00, 0x10); // bit 4 via IN1 (exercises the OR fold)
const clearEntry = () => seed(0x00, 0x00);   // bit 4 clear on both -> skip the write

test("EQUAL (crafted): loc_1c68 == oracle on the set (B/C) and clear folds (RAM)", { skip }, () => {
  for (const [name, e] of [["setB", setViaBEntry], ["setC", setViaCEntry], ["clear", clearEntry]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_1c68 diverged on the ${name} path`);
  }
  // Positive controls: bit 4 (from either port) raises the control byte; clear leaves it.
  const b = setViaBEntry(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[CTRL], 1, "control: bit 4 via B did not raise the control byte");
  const c = setViaCEntry(); c.routines = STUBS; oracle(c);
  assert.equal(c.mem8[CTRL], 1, "control: bit 4 via C did not raise the control byte");
  const z = clearEntry(); z.routines = STUBS; oracle(z);
  assert.equal(z.mem8[CTRL], 0, "control: clear fold raised the control byte");
  console.log("  EQUAL: loc_1c68 == oracle (RAM): set-via-B, set-via-C, clear + delegate fall-through");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const controlOnly = (m) => { m.mem8[CTRL] = 1; };                              // drops the delegate
  const alwaysWrite = (m) => { m.mem8[CTRL] = 1; drawInputTextColumnsAndSeedScreenFill(m); }; // ignores the gate
  assert.ok(ramDiff(oracle, noOp, setViaBEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, controlOnly, setViaBEntry()), "the control-only twin escaped (delegate)");
  assert.ok(ramDiff(oracle, alwaysWrite, clearEntry()), "the always-write twin escaped (gate)");
  console.log("  TEETH: no-op, control-only, always-write all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["set", setViaBEntry], ["clear", clearEntry]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x1c68, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x1c68, setViaBEntry());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on set + clear; stack-adrift mutant refused");
});
