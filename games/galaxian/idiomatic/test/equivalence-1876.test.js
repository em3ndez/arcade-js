// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1876 — memory-equivalent to the frozen oracle at ROM 0x1876. A pitch-ramp arm tick with three
 * paths, all with memory live-outs only (A/HL are scratch):
 *   - RUN: arm byte 0x41c9 predecrements nonzero AND the ramp countdown 0x41ca is nonzero -> the ramp
 *     advances (tick 0x41ca, add a step to pitch 0x41cb, publish it to 0x41c1, clear composite 0x41c0).
 *   - RESET: arm byte predecrements to zero -> clear 0x41c9 and reload the ramp pair word 0x41ca=0x0020.
 *   - IDLE: arm nonzero but the ramp countdown 0x41ca is already 0 -> nothing written.
 * EQUAL asserts ramDiff==null on each. Teeth: no-op and skip-composite (run), wrong-reload (reset).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { driveRisingPitchRamp as cand } from "../driveRisingPitchRamp.js";
import { loc_1876 as oracle } from "../../translated/loc_1876.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const ARM = 0x41c9;
const COUNTDOWN = 0x41ca;
const PITCH = 0x41cb;
const PITCH_SHADOW = 0x41c1;
const COMPOSITE = 0x41c0;

// Run: arm nonzero after predecrement, ramp countdown running; composite foreign so its clear shows.
const runEntry = () => craft((mem, mm) => {
  mem[ARM] = 5; mem[COUNTDOWN] = 3; mem[PITCH] = 10; mem[COMPOSITE] = 0x55;
  mm.push16(0x9999);
});
// Reset: arm predecrements to zero; ramp pair foreign so the reload shows.
const resetEntry = () => craft((mem, mm) => {
  mem[ARM] = 1; mem[COUNTDOWN] = 0x55; mem[PITCH] = 0x55;
  mm.push16(0x9999);
});
// Idle: arm nonzero but the ramp is already drained.
const idleEntry = () => craft((mem, mm) => { mem[ARM] = 5; mem[COUNTDOWN] = 0; mm.push16(0x9999); });

test("EQUAL (crafted): loc_1876 == oracle across run / reset / idle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, runEntry()), null, "run path diverged");
  assert.equal(ramDiff(oracle, cand, resetEntry()), null, "reset path diverged");
  assert.equal(ramDiff(oracle, cand, idleEntry()), null, "idle path diverged");
  // Non-vacuous: run advances the ramp; reset clears the arm and reloads the pair word.
  const r = runEntry(); r.routines = STUBS; oracle(r);
  assert.equal(r.mem8[COUNTDOWN], 2, "positive control: run did not tick the countdown");
  assert.equal(r.mem8[PITCH], 14, "positive control: run did not advance the pitch");
  assert.equal(r.mem8[PITCH_SHADOW], 14, "positive control: run did not publish the pitch");
  assert.equal(r.mem8[COMPOSITE], 0, "positive control: run did not clear the composite");
  const z = resetEntry(); z.routines = STUBS; oracle(z);
  assert.equal(z.mem8[ARM], 0, "positive control: reset did not clear the arm");
  assert.equal(z.mem8[COUNTDOWN], 0x20, "positive control: reset did not reload the countdown");
  assert.equal(z.mem8[PITCH], 0, "positive control: reset did not reload the pitch");
  console.log("  EQUAL: loc_1876 == oracle — run/reset/idle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipComposite = (m) => { cand(m); m.mem8[COMPOSITE] = 0x55; };   // ticks but leaves composite dirty
  const wrongReload = (m) => { m.mem8[ARM] = 0; m.mem8[COUNTDOWN] = 0x21; m.mem8[PITCH] = 0; };
  assert.ok(ramDiff(oracle, noOp, runEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, skipComposite, runEntry()), "the skip-composite twin escaped");
  assert.ok(ramDiff(oracle, wrongReload, resetEntry()), "the wrong-reload twin escaped");
  console.log("  TEETH: no-op, skip-composite (run), wrong-reload (reset) all caught");
});
