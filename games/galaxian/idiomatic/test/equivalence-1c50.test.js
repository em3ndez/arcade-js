// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c50 — memory-equivalent to the frozen oracle at ROM 0x1c50. Reads input port IN1 (0x6800); if either
 * of its low two bits is set it seeds control byte 0x41df=0x16, then it always falls through into the
 * sound-request/column-draw link (requestSound6AndContinueInputScan), handing it the full IN1 byte and the
 * IN0 byte the caller holds in B. IN0 (B) and the fresh IN1 are consumed downstream (bit tests 2-3, then 4);
 * the caller reads no register back, so 1c50's own write and every delegate effect land in work RAM / VRAM
 * and ramDiff is the live-out check. Teeth: no-op, seed-only (drops the delegate), wrong const, wrong cell,
 * inverted gate. Plus an SP-seam tooth on the set and clear paths (the body tail-delegates through the omitted
 * ret); a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_1c50 as cand } from "../loc_1c50.js";
import { loc_1c50 as oracle } from "../../translated/loc_1c50.js";
import { requestSound6AndContinueInputScan } from "../requestSound6AndContinueInputScan.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CTRL = 0x41df; // control byte 1c50 seeds to 0x16 when IN1's low two bits fold set

// Seat SP, put IN0 in B, and give the ports a deterministic input state (IN0 bit 6 clear -> the downstream
// screen-fill init runs its full body, so a dropped delegate is observable in RAM). in1 selects the path.
function seed(in0, in1) {
  return craft((mem, m) => {
    m.push16(0x9999);
    m.regs.b = in0 & 0xff;
    m.io.inputAssert = null;
    m.io.in0 = in0 & 0xff; m.io.in1 = in1 & 0xff; m.io.in2 = 0x00;
    mem[CTRL] = 0;
  });
}
const setBit0 = () => seed(0x00, 0x01); // IN1 bit0 -> seed; downstream leaves CTRL alone -> CTRL ends 0x16
const setBit1 = () => seed(0x00, 0x02); // IN1 bit1 -> seed
const clear = () => seed(0x00, 0x00);   // neither low bit -> skip the seed
const delegateSeeds = () => seed(0x00, 0x0c); // low bits clear (1c50 skips) but bits 2-3 -> delegate seeds 6
const bothSet = () => seed(0x04, 0x03); // 1c50 seeds 0x16, then delegate's bit-2 fold overwrites CTRL=6

test("EQUAL (crafted): loc_1c50 == oracle across IN1 paths (RAM)", { skip }, () => {
  for (const [name, e] of [["setBit0", setBit0], ["setBit1", setBit1], ["clear", clear],
                           ["delegateSeeds", delegateSeeds], ["bothSet", bothSet]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_1c50 diverged on the ${name} path`);
  }
  // Positive controls: the set path drives CTRL to 0x16 (isolated), the clear path leaves it, delegate wins ties.
  const s = setBit0(); s.routines = STUBS; oracle(s);
  assert.equal(s.mem8[CTRL], 0x16, "control: IN1 bit0 did not seed the control byte to 0x16");
  const z = clear(); z.routines = STUBS; oracle(z);
  assert.equal(z.mem8[CTRL], 0, "control: clear path seeded the control byte");
  const b = bothSet(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[CTRL], 6, "control: delegate's later seed did not overwrite to 6");
  console.log("  EQUAL: loc_1c50 == oracle (RAM): setBit0/setBit1 -> 0x16, clear -> 0, delegate overwrite -> 6");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const seedOnly = (m, in0 = m.regs.b) => {                                  // drops the delegate
    if (m.mem8[0x6800] & 0x03) m.mem8[CTRL] = 0x16;
  };
  const wrongConst = (m, in0 = m.regs.b) => {                               // 0x15 not 0x16
    const in1 = m.mem8[0x6800];
    if (in1 & 0x03) m.mem8[CTRL] = 0x15;
    return requestSound6AndContinueInputScan(m, in0, in1);
  };
  const wrongCell = (m, in0 = m.regs.b) => {                               // neighbouring cell
    const in1 = m.mem8[0x6800];
    if (in1 & 0x03) m.mem8[0x41de] = 0x16;
    return requestSound6AndContinueInputScan(m, in0, in1);
  };
  const invGate = (m, in0 = m.regs.b) => {                                 // seeds when it should not
    const in1 = m.mem8[0x6800];
    if (!(in1 & 0x03)) m.mem8[CTRL] = 0x16;
    return requestSound6AndContinueInputScan(m, in0, in1);
  };
  assert.ok(ramDiff(oracle, noOp, setBit0()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, seedOnly, setBit0()), "the seed-only twin escaped (delegate)");
  assert.ok(ramDiff(oracle, wrongConst, setBit0()), "the wrong-const twin escaped");
  assert.ok(ramDiff(oracle, wrongCell, setBit0()), "the wrong-cell twin escaped");
  assert.ok(ramDiff(oracle, invGate, clear()), "the inverted-gate twin escaped");
  console.log("  TEETH: no-op, seed-only, wrong-const, wrong-cell, inverted-gate all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["set", setBit0], ["clear", clear]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x1c50, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x1c50, setBit0());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on set + clear; stack-adrift mutant refused");
});
