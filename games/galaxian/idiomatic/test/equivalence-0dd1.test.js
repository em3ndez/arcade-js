// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd1 — crafted-entry equivalence vs the frozen translated oracle at ROM 0x0dd1. The routine bumps
 * the actor's phase counter (ix+0x03), then dispatches on the kind field (ix+0x07): masked by 0x70 and
 * equal to 0x60 -> the stored/player target-select branch; otherwise -> the cross-player select. Every
 * live-out is work RAM in the actor record (phase ix+0x03, and the target/delta/accumulator the delegate
 * commits), all in the state dump, so EQUAL is asserted with ramDiff==null on both branches:
 *   - STORED: kind field == 0x60, mode bit set -> commits toward the stored target X.
 *   - CROSS:  kind field != 0x60 -> the ordinary cross-reference target pick.
 * Teeth: no-op, a skip-increment twin (does the right delegate but drops the phase bump), and a
 * wrong-branch twin per branch. The oracle rets through its delegate tail; the return-stack window is
 * masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { advanceActorPhaseAndCommitMove as cand } from "../advanceActorPhaseAndCommitMove.js";
import { loc_0dd1 as oracle } from "../../translated/loc_0dd1.js";
import { commitMoveToStoredOrPlayerTargetX } from "../commitMoveToStoredOrPlayerTargetX.js";
import { commitMoveAcrossPlayerX } from "../commitMoveAcrossPlayerX.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REC = 0x42d0;          // actor record base (also the object-table mode-flag cell the delegate reads)
const KIND = REC + 0x07;     // kind field: (KIND & 0x70) == 0x60 selects the stored-target branch
const MODE_FLAG = REC;       // bit0 selects the delegate's stored-vs-cross pick
const STORED_TARGET = REC + 0x19;
const REF_X = 0x4202;        // cross-reference X
const CUR_X = REC + 0x04;    // actor's current X
const PHASE = REC + 0x03;    // phase/anim counter this routine increments
const TARGET_OUT = REC + 0x19;

// STORED branch: kind == 0x60, mode bit set so the delegate commits the stored target; ref/actor seeded
// so the wrong-branch (cross) twin is deterministic and differs.
const storedEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[KIND] = 0x60;
  mem[MODE_FLAG] = mem[MODE_FLAG] | 0x01;
  mem[STORED_TARGET] = 100;
  mem[REF_X] = 0x80;
  mem[CUR_X] = 60;
  mem[PHASE] = 5;
});
// CROSS branch: kind != 0x60 -> cross-player pick. Mode bit set so the always-stored twin differs.
const crossEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.ix = REC;
  mem[KIND] = 0x00;
  mem[MODE_FLAG] = mem[MODE_FLAG] | 0x01;
  mem[STORED_TARGET] = 100;
  mem[REF_X] = 0x80;
  mem[CUR_X] = 0xc0;
  mem[PHASE] = 5;
});

const noOp = () => {};
// Right delegate on the stored branch but drops the phase bump: isolates the ix+0x03 increment.
const skipInc = (m) => commitMoveToStoredOrPlayerTargetX(m, m.regs.ix);
// Wrong-branch twins still bump the phase, so only the branch selection differs from the oracle.
const alwaysCross = (m) => { m.mem8[PHASE] = m.mem8[PHASE] + 1; commitMoveAcrossPlayerX(m, m.regs.ix); };
const alwaysStored = (m) => { m.mem8[PHASE] = m.mem8[PHASE] + 1; commitMoveToStoredOrPlayerTargetX(m, m.regs.ix); };

test("EQUAL (crafted): loc_0dd1 == oracle bumps phase + commits the stored-target branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, storedEntry()), null, "loc_0dd1 diverged on the stored branch");
  const a = storedEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PHASE], 6, "positive control: oracle bumped the phase counter");
  assert.equal(a.mem8[TARGET_OUT], 100, "positive control: oracle committed the stored target");
  console.log("  EQUAL: loc_0dd1 == oracle, stored branch -> phase 5->6, target 100");
});

test("EQUAL (crafted): loc_0dd1 == oracle bumps phase + commits the cross-reference branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, crossEntry()), null, "loc_0dd1 diverged on the cross branch");
  const a = crossEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PHASE], 6, "positive control: oracle bumped the phase counter");
  assert.equal(a.mem8[TARGET_OUT], 0x30, "positive control: oracle committed the cross-reference target");
  console.log("  EQUAL: loc_0dd1 == oracle, cross branch -> phase 5->6, target 0x30");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, storedEntry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipInc, storedEntry()), "skip-increment twin escaped (phase not checked)");
  assert.ok(ramDiff(oracle, alwaysCross, storedEntry()), "always-cross twin escaped (wrong branch)");
  assert.ok(ramDiff(oracle, alwaysStored, crossEntry()), "always-stored twin escaped (wrong branch)");
  console.log("  TEETH: no-op, skip-increment, and both wrong-branch twins all caught");
});
