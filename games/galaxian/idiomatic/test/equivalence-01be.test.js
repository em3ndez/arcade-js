// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_01be — memory-equivalent to the frozen oracle. Arms the dwell flag (0x4019=1) then ticks the
 * prescaled sub-timer (0x4008); on wrap the sub-timer reloads to 0x3c and cascades into the 0x4009 tier
 * (dec, carry into 0x400a). Two paths exercised: sub-timer running (plain dec) and sub-timer wrapping
 * (reload + cascade). Live-out is work RAM only; the return-stack window is masked by ramDiff.
 * Teeth: no-op, arm-only, tick-only twins each leave a divergent cell.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { armStepCountdownAndTickSequenceTimer as cand } from "../armStepCountdownAndTickSequenceTimer.js";
import { loc_01be as oracle } from "../../translated/loc_01be.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DWELL_FLAG = 0x4019;
const SUB_TIMER = 0x4008;
const DWELL_TIER = 0x4009;

// Sub-timer running: a plain decrement, flag armed.
const running = () => craft((mem, m) => { m.push16(0x9999); mem[DWELL_FLAG] = 0; mem[SUB_TIMER] = 5; });
// Sub-timer about to wrap: reload + cascade into the next tier.
const wrapping = () => craft((mem, m) => {
  m.push16(0x9999); mem[DWELL_FLAG] = 0; mem[SUB_TIMER] = 1; mem[DWELL_TIER] = 3;
});

const noOp = () => {};
const armOnly = (m) => { m.mem8[DWELL_FLAG] = 1; };
const tickOnly = (m) => { m.mem8[SUB_TIMER] = (m.mem8[SUB_TIMER] - 1) & 0xff; };

test("EQUAL (crafted): loc_01be == oracle, sub-timer running", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, running()), null, "loc_01be diverged on the running path");
  const a = running(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DWELL_FLAG], 1, "positive control: dwell flag armed");
  assert.equal(a.mem8[SUB_TIMER], 4, "positive control: sub-timer 5->4");
  console.log("  EQUAL: loc_01be == oracle (RAM), flag armed + sub-timer 5->4");
});

test("EQUAL (crafted): loc_01be == oracle, sub-timer wrapping", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, wrapping()), null, "loc_01be diverged on the wrap path");
  const a = wrapping(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUB_TIMER], 0x3c, "positive control: sub-timer reloaded on wrap");
  assert.equal(a.mem8[DWELL_TIER], 2, "positive control: next tier cascaded 3->2");
  console.log("  EQUAL: loc_01be == oracle (RAM), wrap reload 0x3c + cascade 3->2");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, running()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, armOnly, running()), "the arm-only twin escaped (no tick)");
  assert.ok(ramDiff(oracle, tickOnly, running()), "the tick-only twin escaped (no arm)");
  console.log("  TEETH: no-op, arm-only, tick-only all caught (RAM)");
});
