// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e2b — crafted-entry equivalence vs the frozen object state-handler at ROM 0x0e2b.
 * Bumps the per-object counter (record+3), runs the flight curve (dissolved advanceObjectFlightCurve),
 * folds increment (record+9) + heading (record+0x19) into a new Y (record+4), and either advances the
 * dispatch state (record+2) or scans the row table and hands off to loc_11e0. Every effect lands in work
 * RAM (the object record, the direction octant, the 0x4260 slot table), so ramDiff covers the live-out;
 * this handler returns no register the loc_0cc3 caller reads back (it exx-brackets the call and re-derives
 * IX itself). The flight-curve fields are seeded so the heading hi-byte lands at 0 (Y stays controllable)
 * while ACC1_LO advances 0 -> 0x20, giving the curve a visible RAM footprint for the reset-curve tooth.
 *
 * Paths: A too-high Y -> state += 2; B wrapped counter -> state += 1; C active-flag gate -> early ret;
 * D active + delayed-event clear + row match -> loc_11b0 octant then loc_11e0 handoff; E delayed-event
 * set -> loc_11b0 octant then ret. Teeth: no-op, wrong state delta, wrong Y, reset curve, undo handoff,
 * spurious octant write on the gated path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_0e2b as cand } from "../loc_0e2b.js";
import { loc_0e2b as oracle } from "../../translated/loc_0e2b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x42d0; // an object record, clear of the 0x4260 slot table and the return-stack window
const STATE = OBJ + 0x02, POS = OBJ + 0x03, Y = OBJ + 0x04, OCTANT = OBJ + 0x05, INC = OBJ + 0x09;
const SEED = OBJ + 0x18, ACC1_HI = OBJ + 0x19, ACC2_HI = OBJ + 0x1a, ACC1_LO = OBJ + 0x1b, ACC2_LO = OBJ + 0x1c;

const ACTIVE = 0x4200;     // object-active flag (bit0)
const DELAYED = 0x422b;    // delayed-event flag (bit0)
const ROWTAB = 0x4213;     // low byte = row count, high byte = match value
const TARGET_X = 0x4202;   // target X anchor read by loc_11b0
const SLOT0 = 0x4260;      // first entry of the 14-slot loc_11e0 fill table

// Seed the flight-curve fields so the heading hi-byte stays 0 and ACC1_LO advances 0 -> 0x20.
function seedCurve(mem) {
  mem[SEED] = 0x00; mem[ACC1_HI] = 0x00; mem[ACC2_HI] = 0x10; mem[ACC1_LO] = 0x00; mem[ACC2_LO] = 0x00;
}

// A: pos 0x10->0x11, inc 0x05 -> Y 0x05 -> (Y+7)=0x0c < 0x0e -> state += 2.
const pathA = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[STATE] = 0x03; mem[POS] = 0x10; mem[INC] = 0x05; mem[Y] = 0x00;
});
// B: pos 0xb7->0xb8, +0x48 carries -> state += 1; inc 0x40 -> Y 0x40 (not too-high).
const pathB = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[STATE] = 0x03; mem[POS] = 0xb7; mem[INC] = 0x40; mem[Y] = 0x00;
});
// C: not too-high, not wrapped, active flag bit0 clear -> ret right after storing Y (no octant).
const pathC = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[STATE] = 0x03; mem[POS] = 0x10; mem[INC] = 0x40; mem[OCTANT] = 0xaa; mem[ACTIVE] = 0x00;
});
// D: active + delayed-event clear + immediate row match (H == pos 0x11) -> octant then loc_11e0 fills slot 0.
const pathD = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[STATE] = 0x03; mem[POS] = 0x10; mem[INC] = 0x40; mem[OCTANT] = 0xaa;
  mem[ACTIVE] = 0x01; mem[DELAYED] = 0x00; mem[TARGET_X] = 0x60;
  mem[ROWTAB] = 0x03; mem[ROWTAB + 1] = 0x11; // count 3, match value 0x11
  mem[SLOT0] = 0x00;                          // slot 0 free -> loc_11e0 fills it
});
// E: active + delayed-event set -> octant computed (writes record+5) then ret before the row scan.
const pathE = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[STATE] = 0x03; mem[POS] = 0x10; mem[INC] = 0x40; mem[OCTANT] = 0xaa;
  mem[ACTIVE] = 0x01; mem[DELAYED] = 0x01; mem[TARGET_X] = 0x60;
});
// F: like D but the scan value 0x11 MISSES first and matches only after one +0x19 stride (0x2a) --
// exercises the scan loop body (stride step + a later-iteration match) rather than an immediate hit.
const pathF = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[STATE] = 0x03; mem[POS] = 0x10; mem[INC] = 0x40; mem[OCTANT] = 0xaa;
  mem[ACTIVE] = 0x01; mem[DELAYED] = 0x00; mem[TARGET_X] = 0x60;
  mem[ROWTAB] = 0x03; mem[ROWTAB + 1] = 0x2a; // count 3, match 0x2a = 0x11 + one 0x19 stride
  mem[SLOT0] = 0x00;
});
// G: match value never reached in the scanned rows {0x11,0x2a,0x43} -- loop runs count down to 0 and
// breaks with NO handoff, exercising the count-wrap exit.
const pathG = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.ix = OBJ; seedCurve(mem);
  mem[STATE] = 0x03; mem[POS] = 0x10; mem[INC] = 0x40; mem[OCTANT] = 0xaa;
  mem[ACTIVE] = 0x01; mem[DELAYED] = 0x00; mem[TARGET_X] = 0x60;
  mem[ROWTAB] = 0x03; mem[ROWTAB + 1] = 0x99; // no row equals a value the 3-stride scan visits
  mem[SLOT0] = 0x00;
});

test("EQUAL (crafted): loc_0e2b == oracle, too-high Y -> state += 2", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathA()), null, "loc_0e2b diverged on the too-high path");
  const a = pathA(); oracle(a);
  assert.equal(a.mem8[POS], 0x11, "positive control: counter bumped");
  assert.equal(a.mem8[Y], 0x05, "positive control: Y stored");
  assert.equal(a.mem8[STATE], 0x05, "positive control: state += 2");
  assert.equal(a.mem8[ACC1_LO], 0x20, "positive control: flight curve advanced (delegation ran)");
});

test("EQUAL (crafted): loc_0e2b == oracle, wrapped counter -> state += 1", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathB()), null, "loc_0e2b diverged on the wrapped-counter path");
  const a = pathB(); oracle(a);
  assert.equal(a.mem8[POS], 0xb8, "positive control: counter bumped to wrap");
  assert.equal(a.mem8[Y], 0x40, "positive control: Y stored");
  assert.equal(a.mem8[STATE], 0x04, "positive control: state += 1");
});

test("EQUAL (crafted): loc_0e2b == oracle, active-flag gate -> early ret", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathC()), null, "loc_0e2b diverged on the active-flag gate");
  const a = pathC(); oracle(a);
  assert.equal(a.mem8[Y], 0x40, "positive control: Y stored");
  assert.equal(a.mem8[STATE], 0x03, "positive control: state untouched");
  assert.equal(a.mem8[OCTANT], 0xaa, "positive control: octant NOT written (loc_11b0 skipped)");
});

test("EQUAL (crafted): loc_0e2b == oracle, row match -> octant + loc_11e0 handoff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathD()), null, "loc_0e2b diverged on the row-match handoff");
  const a = pathD(); oracle(a);
  assert.notEqual(a.mem8[OCTANT], 0xaa, "positive control: octant written (loc_11b0 ran)");
  assert.equal(a.mem8[SLOT0], 0x01, "positive control: loc_11e0 marked slot 0 active");
  assert.equal(a.mem8[SLOT0 + 1], 0x11, "positive control: loc_11e0 stored the object counter");
});

test("EQUAL (crafted): loc_0e2b == oracle, delayed-event set -> octant then ret", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathE()), null, "loc_0e2b diverged on the delayed-event gate");
  const a = pathE(); oracle(a);
  assert.notEqual(a.mem8[OCTANT], 0xaa, "positive control: octant written (loc_11b0 ran)");
});

test("EQUAL (crafted): loc_0e2b == oracle, row match after one stride -> loc_11e0 handoff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathF()), null, "loc_0e2b diverged on the multi-stride row scan");
  const a = pathF(); oracle(a);
  assert.equal(a.mem8[SLOT0], 0x01, "positive control: stride reached the match -> loc_11e0 filled slot 0");
});

test("EQUAL (crafted): loc_0e2b == oracle, row scan exhausts count -> no handoff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, pathG()), null, "loc_0e2b diverged on the count-wrap row scan");
  const a = pathG(); oracle(a);
  assert.equal(a.mem8[SLOT0], 0x00, "positive control: no match across the scanned rows -> slot 0 left free");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongStateDelta = (m) => { cand(m); m.mem8[STATE] -= 1; };
  const wrongY = (m) => { cand(m); m.mem8[Y] ^= 0xff; };
  const resetCurve = (m) => { cand(m); m.mem8[ACC1_LO] = 0x00; };
  const undoHandoff = (m) => { cand(m); m.mem8[SLOT0] = 0x00; };
  const spuriousOctant = (m) => { cand(m); m.mem8[OCTANT] = (m.mem8[OCTANT] + 1) & 0xff; };

  assert.ok(ramDiff(oracle, noOp, pathA()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongStateDelta, pathA()), "wrong-state-delta twin escaped");
  assert.ok(ramDiff(oracle, wrongY, pathA()), "wrong-Y twin escaped");
  assert.ok(ramDiff(oracle, resetCurve, pathA()), "reset-curve twin escaped (delegation skipped)");
  assert.ok(ramDiff(oracle, undoHandoff, pathD()), "undo-handoff twin escaped (loc_11e0 skipped)");
  assert.ok(ramDiff(oracle, undoHandoff, pathF()), "undo-handoff on the multi-stride match escaped");
  assert.ok(ramDiff(oracle, spuriousOctant, pathC()), "spurious-octant twin escaped (gate bypassed)");
  console.log("  TEETH: no-op, wrong-state, wrong-Y, reset-curve, undo-handoff (immediate + strided), spurious-octant all caught");
});
