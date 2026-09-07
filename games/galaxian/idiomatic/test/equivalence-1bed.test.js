// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanObjRamTestRampAndFinishSelfTest — memory-equivalent to the frozen power-on self-test ramp scan at ROM 0x1bed. A crafted entry lays
 * the OBJRAM colour ramp (seed +0x2f per cell) and seats HL = OBJRAM + A = seed the way fillObjRamTestRamp hands over;
 * the scan verifies the ramp, and on the final pass (the pass counter 0x4008 decrements to 0) it clears OBJRAM
 * and seeds the next boot phase (mode/lamps/flags + two diagnostic VRAM cells). EQUAL asserts idiomatic ==
 * oracle RAM on both an early-ret entry (0x4008 > 1) and the final-pass entry (0x4008 == 1), non-vacuously.
 * TEETH: a corrupted ramp cell makes the scan throw (the RAM-fault arm is load-bearing, dead only on good RAM)
 * and a no-op leaves the final-pass writes undone.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { scanObjRamTestRampAndFinishSelfTest as cand } from "../scanObjRamTestRampAndFinishSelfTest.js";
import { loc_1bed as oracle } from "../../translated/loc_1bed.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const OBJRAM = 0x5800, RAMP_STEP = 0x2f, PASS_COUNTER = 0x4008;

// Lay the ramp the scan expects, seat HL = OBJRAM (oracle scans from HL) and A = seed, set the pass counter.
function entry(seed, passes) {
  return craft((mem8, e) => {
    e.push16(0x9999);
    let v = seed & 0xff;
    for (let i = 0; i < 0x100; i++) { mem8[OBJRAM + i] = v; v = (v + RAMP_STEP) & 0xff; }
    mem8[PASS_COUNTER] = passes;
    e.regs.hl = OBJRAM;
    e.regs.a = seed;
  });
}

test("EQUAL: scanObjRamTestRampAndFinishSelfTest == oracle on early-ret and final-pass entries", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry(0x3c, 2)), null, "early-ret (0x4008 > 1) diverged");
  assert.equal(ramDiff(oracle, cand, entry(0x3c, 1)), null, "final-pass (0x4008 == 1) diverged");
  assert.ok(ramDiff(oracle, () => {}, entry(0x3c, 1)), "vacuous: the final pass wrote no RAM");
  console.log("  EQUAL: scanObjRamTestRampAndFinishSelfTest == oracle on early-ret + final-pass");
});

test("TEETH: corrupted ramp throws (scan load-bearing); no-op misses the final-pass writes", { skip }, () => {
  const bad = entry(0x3c, 1);
  bad.mem8[OBJRAM + 0x40] = (bad.mem8[OBJRAM + 0x40] ^ 0xff) & 0xff; // corrupt one ramp cell
  assert.throws(() => cand(bad), "the corrupted ramp did not throw (scan not load-bearing)");
  assert.ok(ramDiff(oracle, () => {}, entry(0x3c, 1)), "the no-op twin escaped the final-pass RAM diff");
  console.log("  TEETH: corrupted ramp throws; no-op caught");
});
