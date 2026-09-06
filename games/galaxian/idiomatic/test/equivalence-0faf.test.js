// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0faf — crafted-entry equivalence vs the frozen object state-handler at ROM 0x0faf.
 * Bumps the per-object counter (record+3), runs the flight curve (dissolved advanceObjectFlightCurve),
 * then per the mode byte (record+0x17) optionally homes the column (record+9) toward the target column
 * (0x4202) before the shared body: Y (record+4) = column + heading. A too-high Y sets state 5, a wrapped
 * counter sets state 4, else the move-throttle (record+0x10) ticks and on expiry the state advances (dec);
 * otherwise, gated by the active flag, it computes the octant (loc_11b0) and scans the row table, handing
 * off to loc_11e0 on a match. Every effect lands in work RAM, so ramDiff covers the live-out; the handler
 * returns no register the loc_0cc3 caller reads back. The curve fields are seeded so the heading hi-byte
 * lands at 0 (Y stays controllable) while ACC1_LO advances 0 -> 0x20 (a visible curve footprint).
 *
 * Paths: FA mode<4 too-high -> state 5; FB mode<4 wrapped -> state 4; FC mode<4 throttle expiry -> dec
 * state; FD mode>4 chase-up then active-flag gate -> ret; FE mode==4 parity-set chase-down then row match
 * -> loc_11b0 octant + loc_11e0 handoff; FF mode==4 parity-clear no-chase then active-flag gate -> ret.
 * Teeth: no-op, wrong state, wrong Y, reset curve, wrong column, wrong throttle, undo handoff, spurious octant.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_0faf as cand } from "../loc_0faf.js";
import { loc_0faf as oracle } from "../../translated/loc_0faf.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x42d0; // an object record, clear of the 0x4260 slot table and the return-stack window
const STATE = OBJ + 0x02, POS = OBJ + 0x03, Y = OBJ + 0x04, OCTANT = OBJ + 0x05, COLUMN = OBJ + 0x09;
const THROTTLE = OBJ + 0x10, MODE = OBJ + 0x17;
const SEED = OBJ + 0x18, ACC1_HI = OBJ + 0x19, ACC2_HI = OBJ + 0x1a, ACC1_LO = OBJ + 0x1b, ACC2_LO = OBJ + 0x1c;

const ACTIVE = 0x4200;   // object-active flag (bit0)
const DELAYED = 0x422b;  // delayed-event flag (bit0)
const ROWTAB = 0x4213;   // low byte = row count, high byte = match value
const TARGET_X = 0x4202; // target column (chase target) + loc_11b0 X anchor
const FRAME = 0x425f;    // frame-parity bit gating the mode-4 chase
const SLOT0 = 0x4260;    // first entry of the 14-slot loc_11e0 fill table

// Seed the flight-curve fields so the heading hi-byte stays 0 and ACC1_LO advances 0 -> 0x20.
function seedCurve(mem) {
  mem[SEED] = 0x00; mem[ACC1_HI] = 0x00; mem[ACC2_HI] = 0x10; mem[ACC1_LO] = 0x00; mem[ACC2_LO] = 0x00;
}

// FA: mode 2 (<4, no chase), column 0x05 -> Y 0x05 -> (Y+7)=0x0c < 0x0e -> state 5.
const pathA = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x02; mem[STATE] = 0x09; mem[POS] = 0x10; mem[COLUMN] = 0x05; mem[Y] = 0x00;
});
// FB: mode 2, column 0x40 -> Y 0x40 (not too-high); pos 0xbf->0xc0, +0x40 carries -> state 4.
const pathB = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x02; mem[STATE] = 0x09; mem[POS] = 0xbf; mem[COLUMN] = 0x40; mem[Y] = 0x00;
});
// FC: mode 2, Y 0x40, pos not wrapped, throttle 1 -> dec to 0 -> state -= 1.
const pathC = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x02; mem[STATE] = 0x09; mem[POS] = 0x10; mem[COLUMN] = 0x40; mem[THROTTLE] = 0x01;
});
// FD: mode 6 (>4, always chase), target 0x60 >= column 0x40 -> chase up to 0x41; active-flag clear -> ret.
const pathD = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x06; mem[STATE] = 0x09; mem[POS] = 0x10; mem[COLUMN] = 0x40; mem[THROTTLE] = 0x05;
  mem[OCTANT] = 0xaa; mem[TARGET_X] = 0x60; mem[ACTIVE] = 0x00;
});
// FE: mode 4, frame parity odd -> chase; target 0x30 < column 0x40 -> chase down to 0x3f; active +
//     delayed-event clear + immediate row match (H == pos 0x11) -> octant then loc_11e0 fills slot 0.
const pathE = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x04; mem[FRAME] = 0x01; mem[STATE] = 0x09; mem[POS] = 0x10; mem[COLUMN] = 0x40;
  mem[THROTTLE] = 0x05; mem[OCTANT] = 0xaa; mem[TARGET_X] = 0x30;
  mem[ACTIVE] = 0x01; mem[DELAYED] = 0x00;
  mem[ROWTAB] = 0x03; mem[ROWTAB + 1] = 0x11; // count 3, match value 0x11
  mem[SLOT0] = 0x00;                          // slot 0 free -> loc_11e0 fills it
});
// FF: mode 4, frame parity even -> no chase; active-flag clear -> ret (column and octant untouched).
const pathF = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x04; mem[FRAME] = 0x00; mem[STATE] = 0x09; mem[POS] = 0x10; mem[COLUMN] = 0x40;
  mem[THROTTLE] = 0x05; mem[OCTANT] = 0xaa; mem[TARGET_X] = 0x30; mem[ACTIVE] = 0x00;
});
// FG: like FE but the scan value 0x11 MISSES first and matches only after one +0x19 stride (0x2a) --
// exercises the scan loop body (stride step + a later-iteration match) rather than an immediate hit.
const pathG = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x04; mem[FRAME] = 0x01; mem[STATE] = 0x09; mem[POS] = 0x10; mem[COLUMN] = 0x40;
  mem[THROTTLE] = 0x05; mem[OCTANT] = 0xaa; mem[TARGET_X] = 0x30;
  mem[ACTIVE] = 0x01; mem[DELAYED] = 0x00;
  mem[ROWTAB] = 0x03; mem[ROWTAB + 1] = 0x2a; // count 3, match 0x2a = 0x11 + one 0x19 stride
  mem[SLOT0] = 0x00;
});
// FH: match value never reached in the scanned rows {0x11,0x2a,0x43} -- loop runs count down to 0 and
// breaks with NO handoff, exercising the count-wrap exit.
const pathH = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[MODE] = 0x04; mem[FRAME] = 0x01; mem[STATE] = 0x09; mem[POS] = 0x10; mem[COLUMN] = 0x40;
  mem[THROTTLE] = 0x05; mem[OCTANT] = 0xaa; mem[TARGET_X] = 0x30;
  mem[ACTIVE] = 0x01; mem[DELAYED] = 0x00;
  mem[ROWTAB] = 0x03; mem[ROWTAB + 1] = 0x99; // no row equals a value the 3-stride scan visits
  mem[SLOT0] = 0x00;
});

test("EQUAL (crafted): loc_0faf == oracle, mode<4 too-high -> state 5", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathA()), null, "loc_0faf diverged on the too-high path");
  const a = pathA(); oracle(a);
  assert.equal(a.mem8[POS], 0x11, "positive control: counter bumped");
  assert.equal(a.mem8[Y], 0x05, "positive control: Y stored");
  assert.equal(a.mem8[STATE], 0x05, "positive control: state set to 5");
  assert.equal(a.mem8[ACC1_LO], 0x20, "positive control: flight curve advanced (delegation ran)");
});

test("EQUAL (crafted): loc_0faf == oracle, mode<4 wrapped counter -> state 4", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathB()), null, "loc_0faf diverged on the wrapped-counter path");
  const a = pathB(); oracle(a);
  assert.equal(a.mem8[POS], 0xc0, "positive control: counter bumped to wrap");
  assert.equal(a.mem8[STATE], 0x04, "positive control: state set to 4");
});

test("EQUAL (crafted): loc_0faf == oracle, mode<4 throttle expiry -> dec state", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathC()), null, "loc_0faf diverged on the throttle-expiry path");
  const a = pathC(); oracle(a);
  assert.equal(a.mem8[THROTTLE], 0x00, "positive control: throttle drained to 0");
  assert.equal(a.mem8[STATE], 0x08, "positive control: state decremented");
});

test("EQUAL (crafted): loc_0faf == oracle, mode>4 chase-up then active gate", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathD()), null, "loc_0faf diverged on the chase-up gate path");
  const a = pathD(); oracle(a);
  assert.equal(a.mem8[COLUMN], 0x41, "positive control: column homed up toward target");
  assert.equal(a.mem8[Y], 0x41, "positive control: Y = chased column + heading");
  assert.equal(a.mem8[THROTTLE], 0x04, "positive control: throttle ticked, not expired");
  assert.equal(a.mem8[STATE], 0x09, "positive control: state untouched");
  assert.equal(a.mem8[OCTANT], 0xaa, "positive control: octant NOT written (loc_11b0 skipped)");
});

test("EQUAL (crafted): loc_0faf == oracle, mode==4 parity chase-down + row handoff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathE()), null, "loc_0faf diverged on the chase-down handoff path");
  const a = pathE(); oracle(a);
  assert.equal(a.mem8[COLUMN], 0x3f, "positive control: column homed down toward target");
  assert.notEqual(a.mem8[OCTANT], 0xaa, "positive control: octant written (loc_11b0 ran)");
  assert.equal(a.mem8[SLOT0], 0x01, "positive control: loc_11e0 marked slot 0 active");
  assert.equal(a.mem8[SLOT0 + 1], 0x11, "positive control: loc_11e0 stored the object counter");
});

test("EQUAL (crafted): loc_0faf == oracle, mode==4 parity-clear no chase", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathF()), null, "loc_0faf diverged on the no-chase path");
  const a = pathF(); oracle(a);
  assert.equal(a.mem8[COLUMN], 0x40, "positive control: column NOT chased (parity clear)");
  assert.equal(a.mem8[OCTANT], 0xaa, "positive control: octant NOT written (loc_11b0 skipped)");
});

test("EQUAL (crafted): loc_0faf == oracle, row match after one stride -> loc_11e0 handoff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathG()), null, "loc_0faf diverged on the multi-stride row scan");
  const a = pathG(); oracle(a);
  assert.equal(a.mem8[SLOT0], 0x01, "positive control: stride reached the match -> loc_11e0 filled slot 0");
});

test("EQUAL (crafted): loc_0faf == oracle, row scan exhausts count -> no handoff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathH()), null, "loc_0faf diverged on the count-wrap row scan");
  const a = pathH(); oracle(a);
  assert.equal(a.mem8[SLOT0], 0x00, "positive control: no match across the scanned rows -> slot 0 left free");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongState = (m) => { cand(m); m.mem8[STATE] ^= 0xff; };
  const wrongY = (m) => { cand(m); m.mem8[Y] ^= 0xff; };
  const resetCurve = (m) => { cand(m); m.mem8[ACC1_LO] = 0x00; };
  const wrongColumn = (m) => { cand(m); m.mem8[COLUMN] = (m.mem8[COLUMN] - 2) & 0xff; };
  const wrongThrottle = (m) => { cand(m); m.mem8[THROTTLE] = (m.mem8[THROTTLE] + 1) & 0xff; };
  const undoHandoff = (m) => { cand(m); m.mem8[SLOT0] = 0x00; };
  const spuriousOctant = (m) => { cand(m); m.mem8[OCTANT] = (m.mem8[OCTANT] + 1) & 0xff; };

  assert.ok(ramDiff(oracle, noOp, pathA()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongState, pathA()), "wrong-state twin escaped");
  assert.ok(ramDiff(oracle, wrongY, pathA()), "wrong-Y twin escaped");
  assert.ok(ramDiff(oracle, resetCurve, pathA()), "reset-curve twin escaped (delegation skipped)");
  assert.ok(ramDiff(oracle, wrongColumn, pathD()), "wrong-column twin escaped (chase wrong)");
  assert.ok(ramDiff(oracle, wrongThrottle, pathC()), "wrong-throttle twin escaped");
  assert.ok(ramDiff(oracle, undoHandoff, pathE()), "undo-handoff twin escaped (loc_11e0 skipped)");
  assert.ok(ramDiff(oracle, undoHandoff, pathG()), "undo-handoff on the multi-stride match escaped");
  assert.ok(ramDiff(oracle, spuriousOctant, pathF()), "spurious-octant twin escaped (gate bypassed)");
  console.log("  TEETH: no-op, state, Y, curve, column, throttle, handoff (immediate + strided), octant all caught");
});
