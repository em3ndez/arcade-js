// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_11b0 — crafted-entry equivalence vs the frozen "aim at target" handler.
 * The live-out is RAM: the object's direction octant written to (ix+0x05). Register A is NOT live-out --
 * both callers (0x0faf, 0x0e2b) reload A immediately after the call -- so the comparison is memory-only.
 * A post-attract seed is cloned; the IX object's Y (ix+3), X (ix+4) and the target-X anchor (0x4202) are
 * poked, with sentinels at ix+5/ix+6 so a no-op is caught. EQUAL asserts ramDiff==null across the positive
 * branch and the left-of-target (mirrored) branch; a non-vacuous control checks the oracle really writes
 * the expected octant. Teeth: no-op, wrong constant, no-mirror and wrong-cell all escape.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_bootSetup.js";
import { loc_11b0 as cand } from "../loc_11b0.js";
import { loc_11b0 as oracle } from "../../translated/loc_11b0.js";
import { loc_11d0 } from "../loc_11d0.js";

const IX = 0x4300; // object record base (work RAM)
const REF_X = 0x4202; // target-X anchor
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// IX object with Y/X poked, target-X poked, sentinels at ix+5/ix+6, return seated.
function entry(objY, objX, refX) {
  return craft((mem, m) => {
    m.push16(0x9999);
    m.regs.ix = IX;
    mem[IX + 3] = objY;
    mem[IX + 4] = objX;
    mem[REF_X] = refX;
    mem[IX + 5] = 0xaa; // sentinel (output cell)
    mem[IX + 6] = 0xbb; // sentinel (must stay untouched)
  });
}

// (objY, objX, refX, expected ix+5) -- verified against the frozen oracle. Last row: left of target -> mirror.
const VECTORS = [
  [0x30, 0x40, 0x50, 0x00],
  [0x80, 0x20, 0xa0, 0x04],
  [0xf0, 0x40, 0x80, 0x04],
  [0x80, 0xa0, 0x20, 0xfc], // target to the left: mirrored octant
];

test("EQUAL (crafted): loc_11b0 == oracle on (ix+5), both branches", { skip }, () => {
  for (const [oy, ox, rx] of VECTORS) {
    assert.equal(ramDiff(oracle, cand, entry(oy, ox, rx)), null,
      `diverged at objY=0x${oy.toString(16)} objX=0x${ox.toString(16)} refX=0x${rx.toString(16)}`);
  }
  // Non-vacuous: the oracle really writes the expected octant (and it differs from the 0xaa sentinel).
  for (const [oy, ox, rx, oct] of VECTORS) {
    const a = entry(oy, ox, rx); oracle(a);
    assert.equal(a.mem8[IX + 5], oct, `control: octant for objY=0x${oy.toString(16)}`);
    assert.equal(a.mem8[IX + 6], 0xbb, "control: ix+6 stays untouched");
  }
  console.log("  EQUAL: loc_11b0 == oracle on (ix+5), positive + mirrored branches");
});

test("TEETH: broken twins are caught in RAM", { skip }, () => {
  const noOp = () => {};
  const wrongConst = (m) => { m.mem8[m.regs.ix + 5] = 0x00; };            // always octant 0
  const wrongCell = (m) => { m.mem8[m.regs.ix + 6] = 0x04; };            // writes the wrong field
  // Faithful except it never mirrors the octant for a left-of-target delta.
  const noMirror = (m) => {
    const { mem8 } = m; const ix = m.regs.ix;
    const vertical = (0xf0 - mem8[ix + 3]) & 0xff;
    const h = mem8[REF_X] - mem8[ix + 4];
    mem8[ix + 5] = loc_11d0(m, h < 0 ? (-h) & 0xff : h, vertical);
  };

  assert.ok(ramDiff(oracle, noOp, entry(0x80, 0x20, 0xa0)), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongConst, entry(0x80, 0x20, 0xa0)), "wrong-const twin escaped");
  assert.ok(ramDiff(oracle, wrongCell, entry(0x80, 0x20, 0xa0)), "wrong-cell twin escaped");
  assert.ok(ramDiff(oracle, noMirror, entry(0x80, 0xa0, 0x20)), "no-mirror twin escaped");
  console.log("  TEETH: no-op, wrong-const, wrong-cell, no-mirror all caught in RAM");
});
