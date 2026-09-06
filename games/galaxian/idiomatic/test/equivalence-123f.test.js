// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_123f — memory-equivalent to the frozen oracle at ROM 0x123f. A per-object hit test: the active object
 * at IX is compared against the reference position (0x4209 X / 0x420a Y). A hit (inside a 6-wide by 12-tall
 * box) raises the hit flag 0x420b and falls through into the deactivate/score routine; an inactive or
 * out-of-box entry returns untouched. The caller invokes this inside an exx swap and reads none of its
 * registers back, so every live-out is work RAM (the hit flag, the object cells, the command queue) ->
 * ramDiff. Teeth exercise the inactive gate, both band edges, and the hit fall-through. Plus an SP-seam
 * tooth on the hit (fall-through) and miss (bare ret) paths; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_123f as cand } from "../loc_123f.js";
import { loc_123f as oracle } from "../../translated/loc_123f.js";
import { awardKillScoreByBandAndDeactivate } from "../awardKillScoreByBandAndDeactivate.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const IX = 0x42d0;          // object base (work RAM: ix and the deactivate/score cells all in the dump)
const REFX = 0x4209, REFY = 0x420a, HITFLAG = 0x420b;
const QHEAD = 0x40a0, QBASE = 0x4000, HEAD = 0xc0;

// Active object centred on the reference position; queue armed so the fall-through enqueue is observable.
const hitEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = IX;
  mem[IX + 0] = 0x01; mem[IX + 3] = 0x40; mem[IX + 4] = 0x40; mem[IX + 7] = 0x30;
  mem[REFX] = 0x40; mem[REFY] = 0x40; mem[HITFLAG] = 0;
  mem[QHEAD] = HEAD; mem[QBASE + HEAD] = 0x80;
});
// Inactive (bit0 clear): nothing happens.
const inactiveEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = IX;
  mem[IX + 0] = 0x00; mem[IX + 3] = 0x40; mem[IX + 4] = 0x40;
  mem[REFX] = 0x40; mem[REFY] = 0x40; mem[HITFLAG] = 0;
});
// Active, X far from the reference: outside the X band.
const outXEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = IX;
  mem[IX + 0] = 0x01; mem[IX + 3] = 0x60; mem[IX + 4] = 0x40; mem[IX + 7] = 0x30;
  mem[REFX] = 0x40; mem[REFY] = 0x40; mem[HITFLAG] = 0;
});
// Active, X in band but Y far: outside the Y band.
const outYEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = IX;
  mem[IX + 0] = 0x01; mem[IX + 3] = 0x40; mem[IX + 4] = 0x60; mem[IX + 7] = 0x30;
  mem[REFX] = 0x40; mem[REFY] = 0x40; mem[HITFLAG] = 0;
});

test("EQUAL (crafted): loc_123f == oracle on the hit, inactive, and out-of-band paths (RAM)", { skip }, () => {
  for (const [name, e] of [["hit", hitEntry], ["inactive", inactiveEntry], ["outX", outXEntry], ["outY", outYEntry]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_123f diverged on the ${name} path`);
  }
  // positive control: the hit path raises the flag, deactivates the object, and enqueues the score request.
  const h = hitEntry(); h.routines = STUBS; oracle(h);
  assert.equal(h.mem8[HITFLAG], 1, "positive control: hit flag not raised");
  assert.equal(h.mem8[IX + 0], 0, "positive control: object not deactivated");
  assert.equal(h.mem8[IX + 1], 1, "positive control: (ix+1) not set");
  assert.equal(h.mem8[QBASE + HEAD], 0x03, "positive control: score request hi byte not enqueued");
  // positive control: the inactive path raises no hit flag.
  const n = inactiveEntry(); n.routines = STUBS; oracle(n);
  assert.equal(n.mem8[HITFLAG], 0, "positive control: inactive entry raised the hit flag");
  console.log("  EQUAL: loc_123f == oracle (RAM), hit fall-through + inactive + both band edges");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const flagOnly = (m) => { m.mem8[HITFLAG] = 1; };                       // raises the flag, skips deactivate/score
  const alwaysAward = (m, obj = m.regs.ix) => { m.mem8[HITFLAG] = 1; awardKillScoreByBandAndDeactivate(m, obj); };
  assert.ok(ramDiff(oracle, noOp, hitEntry()), "the no-op twin escaped (hit)");
  assert.ok(ramDiff(oracle, flagOnly, hitEntry()), "the flag-only twin escaped (hit)");
  assert.ok(ramDiff(oracle, alwaysAward, outXEntry()), "the ignore-the-band twin escaped (outX)");
  console.log("  TEETH: no-op, flag-only, ignore-the-band all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["hit", hitEntry], ["inactive", inactiveEntry]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x123f, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x123f, hitEntry());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on hit + miss; stack-adrift mutant refused");
});
