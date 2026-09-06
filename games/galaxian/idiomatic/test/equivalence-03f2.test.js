// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_03f2 — crafted-entry equivalence vs the frozen translated oracle at ROM 0x03f2. A top-level game-state
 * handler: it runs the per-frame formation prep (sweep oscillator + occupancy summary), then dispatches on
 * the sequence-state selector (0x400a) to one of four sub-state handlers, and finishes at the start-button
 * round launcher (0x0492), the continuation the ROM pushes before its rst-28.
 *
 * The idiomatic form ABSORBS the rst-28 computed jump into a JS switch that calls the named handler for each
 * index directly, so the m.call(0x0028) + its inline word table (0x0400-0x0407) dissolve. The selector only
 * ever holds 0..3 in this state (idx 0/1/2 advance it; idx 3 holds), so a four-arm switch is faithful; an
 * out-of-range value cannot occur here (the oracle would jp past the four-entry table into code bytes), so
 * it is not exercised.
 *
 * One craft per selector value 0..3 asserts ramDiff==null against the oracle. Idx 3 writes only the two
 * start-button lamp latches (board device, NOT in the state dump), so its RAM diff is vacuous and lamp
 * equivalence is compared off io.startLamp as well. Each craft zeroes IN1_SHADOW (0x4011) so the pushed
 * continuation is inert and the per-selector effect is isolated. The dispatcher seats + dispatches, so an
 * SP-seam tooth confirms the stack-neutral body places at the dispatch seam on two arms; a stray-push
 * mutant is refused. Teeth: a no-op twin and a wrong-arm twin per selector value.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_03f2 as cand } from "../loc_03f2.js";
import { loc_03f2 as oracle } from "../../translated/loc_03f2.js";
import { resetObjectRamAndAdvanceSequence } from "../resetObjectRamAndAdvanceSequence.js";
import { holdStartLampsThenAdvanceSequence } from "../holdStartLampsThenAdvanceSequence.js";
import { blankVramRowsThenDriveStartLamps } from "../blankVramRowsThenDriveStartLamps.js";
import { driveStartButtonLamps } from "../driveStartButtonLamps.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEQ = 0x400a;        // sequence-state selector (dispatch index)
const IN1 = 0x4011;        // IN1 shadow read by the pushed continuation
const DWELL = 0x4009;      // dwell / row counter ticked by idx 1/2 handlers
const VRAM_PTR_LO = 0x400b;
const VRAM_PTR_HI = 0x400c;
const STEP1_COUNT = 0x4019; // idx 1 countdown
const FLAG_BLOCK = 0x4100;  // 0x80-byte block cleared by idx 1 on advance
const DIR_FLAG = 0x4018;    // cleared by idx 2 on advance
const MODE_FLAG = 0x425f;   // idx 3 lamp gate (bit5)
const CREDITS = 0x4002;     // idx 3 credit count
const LAMP_GATE = 0x20;     // bit5

// idx 0: seed + reset -> advance selector 0->1, arm dwell 0x10, point the VRAM cursor at 0x5002.
const state0 = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[IN1] = 0;
  mem[SEQ] = 0;
});
// idx 1: countdown at 1 -> decrements to 0 -> advance selector 1->2 and clear the 0x80-byte flag block.
const state1 = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[IN1] = 0;
  mem[SEQ] = 1;
  mem[STEP1_COUNT] = 1;
  mem[FLAG_BLOCK] = 0xff;
});
// idx 2: row counter at 1, cursor at 0x5000 -> last row -> advance selector 2->3, clear the direction flag.
const state2 = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[IN1] = 0;
  mem[SEQ] = 2;
  mem[DWELL] = 1;
  mem[VRAM_PTR_LO] = 0x00;
  mem[VRAM_PTR_HI] = 0x50;
  mem[DIR_FLAG] = 0xff;
});
// idx 3: gate set + two credits -> both lamps on; selector holds at 3 (no advance).
const state3 = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[IN1] = 0;
  mem[SEQ] = 3;
  mem[MODE_FLAG] = LAMP_GATE;
  mem[CREDITS] = 2;
  mm.mem.io.startLamp[0] = 0;
  mm.mem.io.startLamp[1] = 0;
});

// Lamp latches are board device state (not in dumpState); read them off the io device.
function lampsAfter(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m);
  return [m.mem.io.startLamp[0], m.mem.io.startLamp[1]];
}

test("EQUAL (crafted): loc_03f2 == oracle on selector 0 (reset + advance)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, state0()), null, "loc_03f2 diverged on selector 0");
  const a = state0(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SEQ], 1, "positive control: selector advanced 0->1");
  assert.equal(a.mem8[DWELL], 0x10, "positive control: dwell tier armed to 0x10");
  assert.equal(a.mem8[VRAM_PTR_LO], 0x02, "positive control: VRAM cursor low = 0x02");
  assert.equal(a.mem8[VRAM_PTR_HI], 0x50, "positive control: VRAM cursor high = 0x50");
  console.log("  EQUAL: selector 0 -> advance 0->1, dwell 0x10, cursor 0x5002");
});

test("EQUAL (crafted): loc_03f2 == oracle on selector 1 (countdown expiry advance)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, state1()), null, "loc_03f2 diverged on selector 1");
  const a = state1(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SEQ], 2, "positive control: selector advanced 1->2");
  assert.equal(a.mem8[STEP1_COUNT], 0, "positive control: countdown reached zero");
  assert.equal(a.mem8[FLAG_BLOCK], 0, "positive control: flag block cleared on advance");
  console.log("  EQUAL: selector 1 -> advance 1->2, flag block cleared");
});

test("EQUAL (crafted): loc_03f2 == oracle on selector 2 (last-row advance)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, state2()), null, "loc_03f2 diverged on selector 2");
  const a = state2(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SEQ], 3, "positive control: selector advanced 2->3");
  assert.equal(a.mem8[DWELL], 0, "positive control: row counter reached zero");
  assert.equal(a.mem8[DIR_FLAG], 0, "positive control: direction flag cleared on advance");
  console.log("  EQUAL: selector 2 -> advance 2->3, direction flag cleared");
});

test("EQUAL (crafted): loc_03f2 == oracle on selector 3 (drive lamps, hold)", { skip }, () => {
  const e = state3();
  assert.equal(ramDiff(oracle, cand, e), null, "loc_03f2 wrote divergent work RAM on selector 3");
  const lo = lampsAfter(oracle, state3()), lc = lampsAfter(cand, state3());
  assert.deepEqual(lc, lo, "loc_03f2 lamp latches diverged on selector 3");
  // positive controls: the oracle lights both lamps and leaves the selector at 3.
  assert.deepEqual(lo, [1, 1], "positive control: gate set + two credits lights both lamps");
  const a = state3(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SEQ], 3, "positive control: selector holds at 3");
  console.log("  EQUAL: selector 3 -> both lamps lit, selector holds at 3");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Wrong arm on selector 0: run the idx-1 handler instead of idx-0 (countdown path, not reset+advance).
  const wrongArm0 = (m) => holdStartLampsThenAdvanceSequence(m);
  // Wrong arm on selector 1: run the idx-2 handler instead of idx-1.
  const wrongArm1 = (m) => blankVramRowsThenDriveStartLamps(m);
  // Wrong arm on selector 2: run the idx-0 handler instead of idx-2.
  const wrongArm2 = (m) => resetObjectRamAndAdvanceSequence(m);
  assert.ok(ramDiff(oracle, noOp, state0()), "no-op twin escaped (selector 0)");
  assert.ok(ramDiff(oracle, noOp, state1()), "no-op twin escaped (selector 1)");
  assert.ok(ramDiff(oracle, noOp, state2()), "no-op twin escaped (selector 2)");
  assert.ok(ramDiff(oracle, wrongArm0, state0()), "wrong-arm twin escaped (selector 0)");
  assert.ok(ramDiff(oracle, wrongArm1, state1()), "wrong-arm twin escaped (selector 1)");
  assert.ok(ramDiff(oracle, wrongArm2, state2()), "wrong-arm twin escaped (selector 2)");
  // idx 3 writes only lamp latches: a no-drive twin must diverge on io.startLamp.
  const noDrive = () => {};
  const lo = lampsAfter(oracle, state3()), ln = lampsAfter(noDrive, state3());
  assert.notDeepEqual(ln, lo, "no-drive twin escaped (selector 3 lamps)");
  console.log("  TEETH: no-op, wrong-arm, and no-drive twins all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["selector 0", state0], ["selector 3", state3]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x03f2, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  // Null-mutant: a body that leaves a word adrift on the stack (an un-dissolved push16) moves SP off the
  // seat, so the seam MUST refuse it -- invisible to ramDiff.
  const strayPush = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, strayPush, 0x03f2, state0());
  assert.equal(rm.placeable, false, "the stray-push mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on two arms; stray-push mutant refused");
});
