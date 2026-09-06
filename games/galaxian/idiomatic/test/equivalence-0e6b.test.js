// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e6b — crafted-entry equivalence vs the frozen object state-handler at ROM 0x0e6b.
 * Steps the object's position, and when it stays in the window advances the flight curve (dissolved
 * advanceObjectFlightCurve) and folds a new Y; out of the window it bumps the state index before the curve
 * runs. All writes land in the object record (work RAM), so ramDiff covers the live-out. IN-RANGE exercises
 * the curve + Y-store (curve output at the acc-lo cell proves the delegation ran); OUT-OF-RANGE exercises
 * the early state bump with the curve untouched. Teeth: no-op, curve-output-reset, wrong-Y, and no-bump.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { advanceObjectDiveStep as cand } from "../advanceObjectDiveStep.js";
import { loc_0e6b as oracle } from "../../translated/loc_0e6b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const FRAME = 0x425f;
const OBJ = 0x42d0; // an object record, clear of the return-stack window
const STATE = OBJ + 0x02, POS = OBJ + 0x03, Y = OBJ + 0x04, INC = OBJ + 0x09;
const SEED = OBJ + 0x18, ACC1_HI = OBJ + 0x19, ACC2_HI = OBJ + 0x1a, ACC1_LO = OBJ + 0x1b, ACC2_LO = OBJ + 0x1c;

// In-window: pos steps to 0x21, curve runs (acc1-lo 0 -> 0x20), heading 0 + inc 0x30 stores Y = 0x30.
const inRange = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ;
  mem[FRAME] = 0x00; mem[STATE] = 0x05; mem[POS] = 0x20; mem[Y] = 0x00; mem[INC] = 0x30;
  mem[SEED] = 0x00; mem[ACC1_HI] = 0x00; mem[ACC2_HI] = 0x10; mem[ACC1_LO] = 0x00; mem[ACC2_LO] = 0x00;
});
// Out-of-window: pos steps to 0x07 (pos-6 = 1 < 3) -> bump state; the curve never runs.
const outOfRange = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ;
  mem[FRAME] = 0x00; mem[STATE] = 0x05; mem[POS] = 0x06; mem[Y] = 0x55;
  mem[SEED] = 0x00; mem[ACC1_HI] = 0x11; mem[ACC2_HI] = 0x22; mem[ACC1_LO] = 0x33; mem[ACC2_LO] = 0x44;
});

test("EQUAL (crafted): loc_0e6b == oracle in the window (curve + Y store)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, inRange()), null, "loc_0e6b diverged in the window");
  const a = inRange(); oracle(a);
  assert.equal(a.mem8[POS], 0x21, "positive control: position stepped");
  assert.equal(a.mem8[ACC1_LO], 0x20, "positive control: flight curve advanced (delegation ran)");
  assert.equal(a.mem8[Y], 0x30, "positive control: Y stored");
  assert.equal(a.mem8[STATE], 0x05, "positive control: state not bumped in range");
  console.log("  EQUAL: loc_0e6b == oracle (RAM), curve advanced + Y stored");
});

test("EQUAL (crafted): loc_0e6b == oracle out of the window (early state bump)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, outOfRange()), null, "loc_0e6b diverged out of the window");
  const a = outOfRange(); oracle(a);
  assert.equal(a.mem8[POS], 0x07, "positive control: position stepped");
  assert.equal(a.mem8[STATE], 0x06, "positive control: state bumped");
  assert.equal(a.mem8[Y], 0x55, "positive control: Y untouched");
  assert.equal(a.mem8[ACC1_LO], 0x33, "positive control: curve did not run out of window");
  console.log("  EQUAL: loc_0e6b == oracle (RAM), out of window -> state bump, no curve");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const resetCurve = (m) => { cand(m); m.mem8[ACC1_LO] = 0x00; };
  const wrongY = (m) => { cand(m); m.mem8[Y] ^= 0xff; };
  const noBump = (m) => { m.mem8[POS] = (m.mem8[POS] + ((m.mem8[FRAME] & 1) + 1)) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, inRange()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, resetCurve, inRange()), "curve-reset twin escaped (delegation skipped)");
  assert.ok(ramDiff(oracle, wrongY, inRange()), "wrong-Y twin escaped");
  assert.ok(ramDiff(oracle, noBump, outOfRange()), "no-bump twin escaped");
  console.log("  TEETH: no-op, curve-reset, wrong-Y, no-bump all caught");
});
