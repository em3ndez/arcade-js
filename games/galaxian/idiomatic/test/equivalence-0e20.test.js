// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e20 — memory-equivalent to the frozen translated routine.
 * Alternate horizontal target select for the IX object record; its only live-out is the record it commits
 * (work RAM, in the state dump), so EQUAL is asserted on ramDiff over two branches:
 *   - FIXED: bit0 of the object-table mode flag set -> commit toward the stored target X.
 *   - CROSS: bit0 clear -> the ordinary cross-reference target pick.
 * Positive controls confirm the oracle really commits the expected target and advances the planner
 * sub-state on each branch. Teeth: no-op, a single-cell scribble, and a wrong-branch twin per branch
 * (always-cross vs the fixed entry, always-fixed vs the cross entry). Return-stack window masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { commitMoveToStoredOrPlayerTargetX as cand } from "../commitMoveToStoredOrPlayerTargetX.js";
import { loc_0e20 as oracle } from "../../translated/loc_0e20.js";
import { commitMoveAcrossPlayerX } from "../commitMoveAcrossPlayerX.js";
import { commitMoveToTargetX } from "../commitMoveToTargetX.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REC = 0x42d0;          // record base = the object-table entry the routine reads absolutely
const MODE_FLAG = REC;       // bit0 selects the branch
const STORED_TARGET = REC + 0x19;
const REF_X = 0x4202;        // cross-reference X
const CUR_X = REC + 0x04;    // actor's current X
const TARGET_OUT = REC + 0x19;
const SUBSTATE = REC + 0x02;

// FIXED branch: mode bit0 set; both stored target and reference seeded so every twin is deterministic.
const fixedEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[MODE_FLAG] = mem[MODE_FLAG] | 0x01;
  mem[STORED_TARGET] = 100;
  mem[REF_X] = 80;
  mem[CUR_X] = 60;
  mem[SUBSTATE] = 3;
});
// CROSS branch: mode bit0 clear; actor right of the reference -> the left band.
const crossEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[MODE_FLAG] = mem[MODE_FLAG] & ~0x01;
  mem[STORED_TARGET] = 100;
  mem[REF_X] = 80;
  mem[CUR_X] = 200;
  mem[SUBSTATE] = 3;
});

const noOp = () => {};
const scribble = (m) => { cand(m); m.mem8[SUBSTATE] = (m.mem8[SUBSTATE] + 1) & 0xff; };
const alwaysCross = (m) => commitMoveAcrossPlayerX(m, m.regs.ix);
const alwaysFixed = (m) => commitMoveToTargetX(m, m.mem8[STORED_TARGET], m.regs.ix);

test("EQUAL (crafted): loc_0e20 == oracle on the fixed-target branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, fixedEntry()), null, "loc_0e20 diverged on the fixed branch");
  const a = fixedEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TARGET_OUT], 100, "positive control: oracle committed the stored target");
  assert.equal(a.mem8[SUBSTATE], 4, "positive control: oracle advanced the planner sub-state");
  console.log("  EQUAL: loc_0e20 == oracle on the fixed branch (RAM), target 100");
});

test("EQUAL (crafted): loc_0e20 == oracle on the cross-reference branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, crossEntry()), null, "loc_0e20 diverged on the cross branch");
  const b = crossEntry(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[TARGET_OUT], 76, "positive control: oracle committed the cross-reference target");
  assert.equal(b.mem8[SUBSTATE], 4, "positive control: oracle advanced the planner sub-state");
  console.log("  EQUAL: loc_0e20 == oracle on the cross branch (RAM), target 76");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, fixedEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, scribble, fixedEntry()), "the scribble twin escaped");
  assert.ok(ramDiff(oracle, alwaysCross, fixedEntry()), "the always-cross twin escaped (wrong branch)");
  assert.ok(ramDiff(oracle, alwaysFixed, crossEntry()), "the always-fixed twin escaped (wrong branch)");
  console.log("  TEETH: no-op, scribble, and both wrong-branch twins all caught");
});
