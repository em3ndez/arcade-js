// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2231 — memory-equivalent to the frozen oracle at ROM 0x2231. It redraws a packed-BCD score column
 * selected by a counter index: 0 -> player-1 score into the primary field, 1 -> player-2 score into the
 * alt field (only when its live flag 0x400e is set), 2 -> high score into the fixed high-score field. An
 * index of 3 or more descends, redrawing every field from index-1 down to 0. Every live-out is the painted
 * VRAM digit cells (in the state dump) -> ramDiff; the callers tail-dispatch and read no register back. The
 * oracle's descent recursion uses the machine stack, whose scratch window is masked, so a memory diff is
 * complete. Teeth: no-op, a wrong-index twin, and a gate-ignoring twin. Plus an SP-seam tooth on the direct
 * and recursive paths; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_2231 as cand } from "../loc_2231.js";
import { loc_2231 as oracle } from "../../translated/loc_2231.js";
import { drawScoreToSelectedPlayerField } from "../drawScoreToSelectedPlayerField.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PRIMARY = 0x5381;   // primary player field base (drawn downward)
const ALT = 0x5121;       // alt player field base
const HIGH = 0x5241;      // fixed high-score field base
const GATE = 0x400e;      // index-1 live flag / alt-field selector
const P2_SOURCE = 0x40a7; // player-2 score high byte

function seed(mem) {
  mem[0x40a2] = 0x11; mem[0x40a3] = 0x22; mem[0x40a4] = 0x33; // player 1
  mem[0x40a5] = 0x44; mem[0x40a6] = 0x55; mem[0x40a7] = 0x66; // player 2
  mem[0x40a8] = 0x77; mem[0x40a9] = 0x88; mem[0x40aa] = 0x99; // high score
  for (const base of [PRIMARY, ALT, HIGH]) for (let i = 0; i < 6; i++) mem[(base - i * 0x20) & 0xffff] = 0xff;
}
const entry = (a, gate = 0x01) => craft((mem, mm) => {
  seed(mem); mem[GATE] = gate; mm.regs.a = a; mm.push16(0x9999);
});

test("EQUAL (crafted): loc_2231 == oracle across the index paths (RAM)", { skip }, () => {
  const cases = [["index0", entry(0)], ["index1-live", entry(1, 0x01)], ["index1-gated", entry(1, 0x00)],
                 ["index2", entry(2)], ["index3", entry(3, 0x01)], ["index5", entry(5, 0x01)]];
  for (const [name, e] of cases) assert.equal(ramDiff(oracle, cand, e), null, `loc_2231 diverged on ${name}`);
  // positive controls: each index paints its own field; the gated index-1 paints nothing.
  const i0 = entry(0); i0.routines = STUBS; oracle(i0);
  assert.notEqual(i0.mem8[PRIMARY], 0xff, "positive control: index 0 did not paint the primary field");
  const i1 = entry(1, 0x01); i1.routines = STUBS; oracle(i1);
  assert.notEqual(i1.mem8[ALT], 0xff, "positive control: index 1 did not paint the alt field");
  const i2 = entry(2); i2.routines = STUBS; oracle(i2);
  assert.notEqual(i2.mem8[HIGH], 0xff, "positive control: index 2 did not paint the high-score field");
  const g0 = entry(1, 0x00); g0.routines = STUBS; oracle(g0);
  assert.equal(g0.mem8[ALT], 0xff, "positive control: gated index 1 painted the alt field anyway");
  console.log("  EQUAL: loc_2231 == oracle (RAM), index 0/1/2, gated index 1, and index 3/5 descent");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongIndex = (m) => cand(m, 2);                                   // draws the high-score field, not primary
  const ignoreGate = (m) => drawScoreToSelectedPlayerField(m, 1, P2_SOURCE); // draws index 1 despite the gate
  assert.ok(ramDiff(oracle, noOp, entry(0)), "the no-op twin escaped (index 0)");
  assert.ok(ramDiff(oracle, wrongIndex, entry(0)), "the wrong-index twin escaped (index 0)");
  assert.ok(ramDiff(oracle, ignoreGate, entry(1, 0x00)), "the gate-ignoring twin escaped (gated index 1)");
  console.log("  TEETH: no-op, wrong-index, gate-ignoring all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["index0", entry(0)], ["index3", entry(3, 0x01)]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x2231, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x2231, entry(0));
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on the direct + recursive paths; stack-adrift mutant refused");
});
