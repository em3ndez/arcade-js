// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_21fe — memory-equivalent to the frozen oracle at ROM 0x21fe, with the tail dispatch dissolved to the
 * decompiled score-field painter. It zeroes the packed-BCD score field selected by a counter index (0 ->
 * player-1, 1 -> player-2, 2 -> high score) plus that field's companion scratch byte, then repaints the
 * field; an index of 3 or more descends, clearing+repainting every field from index-1 down to 0. Whole
 * contract is RAM: the zeroed score/scratch bytes and the repainted VRAM digit cells — the callers
 * tail-dispatch and read no register back, and the descent recursion uses the machine stack (masked window),
 * so a memory diff is complete. EQUAL asserts ramDiff==null across the direct and descent paths. Teeth:
 * no-op, repaint-without-clear, clear-without-repaint, and a forget-the-scratch twin. Plus an SP-seam tooth
 * on the direct and recursive paths; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_21fe as cand } from "../loc_21fe.js";
import { loc_21fe as oracle } from "../../translated/loc_21fe.js";
import { drawScoreFieldByIndex } from "../drawScoreFieldByIndex.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const P1 = 0x40a2, P2 = 0x40a5, HI = 0x40a8;  // packed-BCD score fields (3 bytes each)
const SCRATCH0 = 0x40ad, SCRATCH1 = 0x40ae;   // companion scratch bytes for index 0 / 1
const PRIMARY = 0x5381, ALT = 0x5121, HIGH = 0x5241;  // score VRAM field bases (drawn downward)
const GATE = 0x400e;                          // index-1 live flag / alt-field selector

function seed(mem) {
  mem[P1] = 0x11; mem[P1 + 1] = 0x22; mem[P1 + 2] = 0x33;
  mem[P2] = 0x44; mem[P2 + 1] = 0x55; mem[P2 + 2] = 0x66;
  mem[HI] = 0x77; mem[HI + 1] = 0x88; mem[HI + 2] = 0x99;
  mem[SCRATCH0] = 0xa1; mem[SCRATCH1] = 0xa2;
  for (const base of [PRIMARY, ALT, HIGH]) for (let i = 0; i < 6; i++) mem[(base - i * 0x20) & 0xffff] = 0xff;
}
const entry = (a, gate = 0x01) => craft((mem, mm) => {
  seed(mem); mem[GATE] = gate; mm.regs.a = a; mm.push16(0x9999);
});

test("EQUAL (crafted): loc_21fe == oracle across the index paths (RAM)", { skip }, () => {
  const cases = [["index0", entry(0)], ["index1-live", entry(1, 0x01)], ["index1-gated", entry(1, 0x00)],
                 ["index2", entry(2)], ["index3", entry(3, 0x01)], ["index5", entry(5, 0x01)]];
  for (const [name, e] of cases) assert.equal(ramDiff(oracle, cand, e), null, `loc_21fe diverged on ${name}`);

  // positive control: index 0 zeroes its score + scratch bytes and repaints the primary field.
  const i0 = entry(0); i0.routines = STUBS; oracle(i0);
  assert.equal(i0.mem8[P1], 0, "control: index 0 did not zero the player-1 score");
  assert.equal(i0.mem8[SCRATCH0], 0, "control: index 0 did not zero its scratch byte");
  assert.notEqual(i0.mem8[PRIMARY], 0xff, "control: index 0 did not repaint the primary field");
  // positive control: index 1 zeroes the player-2 field + its scratch byte.
  const i1 = entry(1, 0x01); i1.routines = STUBS; oracle(i1);
  assert.equal(i1.mem8[P2], 0, "control: index 1 did not zero the player-2 score");
  assert.equal(i1.mem8[SCRATCH1], 0, "control: index 1 did not zero its scratch byte");
  // positive control: index 3 descent clears every field.
  const i3 = entry(3, 0x01); i3.routines = STUBS; oracle(i3);
  assert.equal(i3.mem8[P1] + i3.mem8[P2] + i3.mem8[HI], 0, "control: descent left a field uncleared");
  console.log("  EQUAL: loc_21fe == oracle (RAM), index 0/1/2, gated index 1, and index 3/5 descent");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const repaintOnly = (m) => drawScoreFieldByIndex(m, 0);                 // repaints without clearing
  const clearOnly = (m) => { const x = m.mem8; x[P1] = 0; x[P1 + 1] = 0; x[P1 + 2] = 0; x[SCRATCH0] = 0; };
  const forgetScratch = (m) => {                                          // clears digits + repaints, not scratch
    const x = m.mem8; x[P1] = 0; x[P1 + 1] = 0; x[P1 + 2] = 0; drawScoreFieldByIndex(m, 0);
  };
  assert.ok(ramDiff(oracle, noOp, entry(0)), "the no-op twin escaped (index 0)");
  assert.ok(ramDiff(oracle, repaintOnly, entry(0)), "the repaint-without-clear twin escaped (index 0)");
  assert.ok(ramDiff(oracle, clearOnly, entry(0)), "the clear-without-repaint twin escaped (index 0)");
  assert.ok(ramDiff(oracle, forgetScratch, entry(0)), "the forget-the-scratch twin escaped (index 0)");
  console.log("  TEETH: no-op, repaint-only, clear-only, forget-scratch all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["index0", entry(0)], ["index3", entry(3, 0x01)]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x21fe, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x21fe, entry(0));
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on the direct + recursive paths; stack-adrift mutant refused");
});
