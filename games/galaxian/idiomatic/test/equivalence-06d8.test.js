// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_06d8 — crafted-entry equivalence vs the frozen translated oracle at ROM 0x06d8. An RST-28
 * sequence-state handler that reads the arm gate (0x421d) and two mode flags (0x41b5, 0x400e), all with
 * HL pointing at the sub-state cell (0x400a), and routes to one of four outcomes:
 *   - ADVANCE:  gate set, both flags set -> advance the sub-state counter + reload the dwell timer.
 *   - SET:      gate set, a flag clear   -> set the sub-state cell by the mode bit + reload the dwell.
 *   - RESET:    gate clear, a flag clear -> the shared dwell/reset tail (here: advance, mode bit clear).
 *   - INLINE:   gate clear, both flags set -> inline the tail: bump the sub-state, arm the dwell to 130,
 *               and (mode bit set) enqueue two command words; mode bit clear returns after arming.
 * Every live-out is work RAM (sub-state, dwell, game-state, command queue), all in the state dump, so
 * EQUAL is asserted with ramDiff==null on each path. The tail seats + tail-dispatches, so an SP-tooth
 * confirms the stack-neutral body places at the dispatch seam; a stray-push mutant is refused. Teeth:
 * no-op, a wrong-branch twin, a skip-enqueue twin, and a wrong-delegate twin. Return-stack masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_06d8 as cand } from "../loc_06d8.js";
import { loc_06d8 as oracle } from "../../translated/loc_06d8.js";
import { advanceDwellOrResetToState1 } from "../advanceDwellOrResetToState1.js";
import { setSequenceStateByModeAndReloadDwell } from "../setSequenceStateByModeAndReloadDwell.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SUBSTATE = 0x400a; // sub-state cell HL points at
const DWELL = 0x4009;    // dwell timer (branches reload 0x50; the inline tail arms 130)
const GAME_STATE = 0x4005;
const GATE = 0x421d;     // arm gate
const FLAG1 = 0x41b5;    // mode flag 1
const FLAG2 = 0x400e;    // mode flag 2
const MODE = 0x4006;     // bit0 = mode bit
const HEAD = 0x40a0;     // command-queue write head
const SLOT0 = 0x40c0;    // queue slot at head 0xc0

// gate set, both flags set -> advance the sub-state counter + reload the dwell timer.
const advanceEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SUBSTATE;
  mem[GATE] = 1; mem[FLAG1] = 1; mem[FLAG2] = 1; mem[MODE] = 0;
  mem[SUBSTATE] = 5; mem[DWELL] = 0;
});
// gate set, a flag clear -> set the sub-state cell by the mode bit (clear -> 14) + reload the dwell.
const setEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SUBSTATE;
  mem[GATE] = 1; mem[FLAG1] = 0; mem[MODE] = 0;
  mem[SUBSTATE] = 5; mem[DWELL] = 0;
});
// gate clear, a flag clear, mode bit clear -> the shared dwell/reset tail (advances the sub-state).
const resetEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SUBSTATE;
  mem[GATE] = 0; mem[FLAG1] = 0; mem[MODE] = 0;
  mem[SUBSTATE] = 5; mem[DWELL] = 0;
});
// gate clear, both flags set, mode bit set -> inline the tail and enqueue two words (free the two slots).
const enqueueEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SUBSTATE;
  mem[GATE] = 0; mem[FLAG1] = 1; mem[FLAG2] = 1; mem[MODE] = 1;
  mem[SUBSTATE] = 5; mem[DWELL] = 0;
  mem[HEAD] = 0xc0; mem[SLOT0] = 0x80; mem[SLOT0 + 2] = 0x80;
});
// gate clear, both flags set, mode bit clear -> inline the tail then return without enqueuing.
const inlineRetEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SUBSTATE;
  mem[GATE] = 0; mem[FLAG1] = 1; mem[FLAG2] = 1; mem[MODE] = 0;
  mem[SUBSTATE] = 5; mem[DWELL] = 0;
  mem[HEAD] = 0xc0; mem[SLOT0] = 0x80;
});

test("EQUAL (crafted): loc_06d8 == oracle on the advance branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, advanceEntry()), null, "loc_06d8 diverged on the advance branch");
  const a = advanceEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUBSTATE], 6, "positive control: oracle advanced the sub-state");
  assert.equal(a.mem8[DWELL], 0x50, "positive control: oracle reloaded the dwell timer");
  console.log("  EQUAL: advance branch -> sub-state 5->6, dwell 0x50");
});

test("EQUAL (crafted): loc_06d8 == oracle on the set-by-mode branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, setEntry()), null, "loc_06d8 diverged on the set branch");
  const a = setEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUBSTATE], 14, "positive control: oracle set the sub-state by the clear mode bit");
  assert.equal(a.mem8[DWELL], 0x50, "positive control: oracle reloaded the dwell timer");
  console.log("  EQUAL: set branch -> sub-state 14, dwell 0x50");
});

test("EQUAL (crafted): loc_06d8 == oracle on the dwell/reset tail branch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, resetEntry()), null, "loc_06d8 diverged on the reset-tail branch");
  const a = resetEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUBSTATE], 6, "positive control: oracle advanced the sub-state via the tail");
  assert.equal(a.mem8[DWELL], 0x50, "positive control: oracle reloaded the dwell timer");
  console.log("  EQUAL: reset tail (mode clear) -> sub-state 5->6, dwell 0x50");
});

test("EQUAL (crafted): loc_06d8 == oracle on the inline enqueue tail", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, enqueueEntry()), null, "loc_06d8 diverged on the inline enqueue tail");
  const a = enqueueEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUBSTATE], 6, "positive control: oracle bumped the sub-state");
  assert.equal(a.mem8[DWELL], 130, "positive control: oracle armed the dwell to 130");
  assert.equal(a.mem8[SLOT0], 0x06, "positive control: first command word hi byte");
  assert.equal(a.mem8[SLOT0 + 1], 0x02, "positive control: first command word lo byte");
  assert.equal(a.mem8[SLOT0 + 2], 0x06, "positive control: second command word hi byte");
  assert.equal(a.mem8[SLOT0 + 3], 0x00, "positive control: second command word lo byte");
  assert.equal(a.mem8[HEAD], 0xc4, "positive control: write-head advanced past both words");
  console.log("  EQUAL: inline tail (mode set) -> sub-state 6, dwell 130, two words enqueued");
});

test("EQUAL (crafted): loc_06d8 == oracle on the inline tail returning without enqueue", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, inlineRetEntry()), null, "loc_06d8 diverged on the inline-ret branch");
  const a = inlineRetEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUBSTATE], 6, "positive control: oracle bumped the sub-state");
  assert.equal(a.mem8[DWELL], 130, "positive control: oracle armed the dwell to 130");
  assert.equal(a.mem8[SLOT0], 0x80, "positive control: queue untouched with the mode bit clear");
  console.log("  EQUAL: inline tail (mode clear) -> sub-state 6, dwell 130, no enqueue");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Wrong branch: runs the reset tail on the inline-enqueue entry (mode set -> reset+silence, not inline).
  const takeResetTail = (m) => advanceDwellOrResetToState1(m, SUBSTATE);
  // Right inline arithmetic but skips the two enqueues.
  const skipEnqueue = (m) => { m.mem8[SUBSTATE] = m.mem8[SUBSTATE] + 1; m.mem8[DWELL] = 130; };
  // Wrong delegate on the advance branch: sets by mode (->14) instead of advancing (->6).
  const wrongDelegate = (m) => setSequenceStateByModeAndReloadDwell(m, SUBSTATE);
  assert.ok(ramDiff(oracle, noOp, advanceEntry()), "no-op twin escaped (advance)");
  assert.ok(ramDiff(oracle, noOp, enqueueEntry()), "no-op twin escaped (enqueue)");
  assert.ok(ramDiff(oracle, takeResetTail, enqueueEntry()), "wrong-branch twin escaped (reset vs inline)");
  assert.ok(ramDiff(oracle, skipEnqueue, enqueueEntry()), "skip-enqueue twin escaped");
  assert.ok(ramDiff(oracle, wrongDelegate, advanceEntry()), "wrong-delegate twin escaped");
  console.log("  TEETH: no-op, wrong-branch, skip-enqueue, wrong-delegate all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["inline-enqueue", enqueueEntry], ["advance", advanceEntry]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x06d8, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  // Null-mutant: a body that leaves a word adrift on the stack (a dropped push16 left un-dissolved) moves
  // SP off the seat, so the seam MUST refuse it — invisible to ramDiff.
  const strayPush = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, strayPush, 0x06d8, enqueueEntry());
  assert.equal(rm.placeable, false, "the stray-push mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places; stray-push mutant refused");
});
