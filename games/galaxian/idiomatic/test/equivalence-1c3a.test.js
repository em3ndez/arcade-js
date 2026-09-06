// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c3a — memory-equivalent to the frozen oracle at ROM 0x1c3a. The per-frame main-loop input step:
 * run the sound driver's per-frame tick (driveSoundFrame) and the once-every-other-frame decaying sweep
 * (driveDecayingSoundSweep), pet the watchdog (read 0x7800, discarded), then read IN0 (0x6000) -- if any
 * arm bit (mask 0x83: bits 7/1/0) is set, raise the pitch-ramp arm cell 0x41c9=1 -- and fall through into
 * the input scan chain (requestSoundOnInput1AndContinueScan), handing it the raw IN0 for the downstream
 * IN0|IN1 bit tests. The caller reads no register back (the chain's own bit tests take the IN0 param), so
 * every effect lands in work RAM / VRAM and ramDiff is the live-out check.
 *
 * The seed pokes the arm cell 0x41c9=1: driveSoundFrame's ramp tick clears it to 0, so the store's effect
 * is isolated -- the set path re-raises it to 1, the clear path leaves it 0.
 *
 * Teeth: no-op, dropped store, wrong store value, wrong store cell, inverted gate, dropped sound-frame
 * tick, dropped decaying sweep, dropped scan chain. Plus an SP-seam tooth (the body tail-delegates through
 * the omitted ret): a stack-adrift mutant is refused. Positive controls: set path -> 0x41c9==1, clear path
 * -> 0x41c9==0, and a non-vacuity control (oracle vs no-op differs).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { driveSoundFrameAndScanInput as cand } from "../driveSoundFrameAndScanInput.js";
import { loc_1c3a as oracle } from "../../translated/loc_1c3a.js";
import { driveSoundFrame } from "../driveSoundFrame.js";
import { driveDecayingSoundSweep } from "../driveDecayingSoundSweep.js";
import { requestSoundOnInput1AndContinueScan } from "../requestSoundOnInput1AndContinueScan.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const ARM = 0x41c9; // pitch-ramp arm cell the routine raises to 1 when an IN0 arm bit is set
const ARM_MASK = 0x83; // IN0 bits 7, 1, 0 -> arm
const SWEEP_FRAME = 0x4007; // driveDecayingSoundSweep even-frame gate (bit0 clear -> it acts)
const SWEEP_COUNT = 0x41df; // driveDecayingSoundSweep countdown (nonzero -> it writes + decrements)
const SND_FLAG = 0x41c0; // driveSoundFrame clears this composite flag byte every tick
const SND_PITCH = 0x41c1; // driveSoundFrame primes this pitch shadow to 0xff every tick

// Seat SP on a real caller-return word, seat the ports, and poke the arm cell to 1 (driveSoundFrame clears
// it). `extra` layers extra cell pokes. IN0 bit6 is kept clear on the play paths so the downstream
// screen-fill body runs and a dropped delegate is observable in RAM.
function seed(in0, in1, extra) {
  return craft((mem, m) => {
    m.push16(0x9999); // one caller-return word for the fall-through chain's single net ret
    m.io.inputAssert = null;
    m.io.in0 = in0 & 0xff;
    m.io.in1 = in1 & 0xff;
    m.io.in2 = 0x00;
    mem[ARM] = 1;
    if (extra) extra(mem, m);
  });
}

const setBit0 = () => seed(0x01, 0x01); // IN0 bit0 in mask -> store; downstream body runs (IN0 bit6 clear)
const setBit1 = () => seed(0x02, 0x01); // IN0 bit1
const setBit7 = () => seed(0x80, 0x01); // IN0 bit7
const setAll = () => seed(0x83, 0x01); //  all three arm bits set
const clear0 = () => seed(0x00, 0x01); //  no arm bits -> no store
const clearNonArm = () => seed(0x7c, 0x01); // bits 2-6 set, none in mask -> still no store
// Sweep active: even frame + nonzero countdown, inputs quiet so the scan chain leaves the countdown alone.
const sweepActive = () => seed(0x00, 0x00, (mem) => { mem[SWEEP_FRAME] = 0x00; mem[SWEEP_COUNT] = 0x40; });

test("EQUAL (crafted): loc_1c3a == oracle across IN0 arm paths (RAM)", { skip }, () => {
  for (const [name, e] of [
    ["setBit0", setBit0], ["setBit1", setBit1], ["setBit7", setBit7], ["setAll", setAll],
    ["clear0", clear0], ["clearNonArm", clearNonArm], ["sweepActive", sweepActive],
  ]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_1c3a diverged on the ${name} path`);
  }
  // Positive controls (from the real oracle run): set path raises the arm cell to 1, clear path leaves 0.
  const s = setBit0(); s.routines = STUBS; oracle(s);
  assert.equal(s.mem8[ARM], 1, "control: an IN0 arm bit did not raise the arm cell to 1");
  const z = clear0(); z.routines = STUBS; oracle(z);
  assert.equal(z.mem8[ARM], 0, "control: the clear path raised the arm cell");
  // Non-vacuity: the oracle actually changes RAM (so EQUAL is not passing on a no-op oracle).
  assert.ok(ramDiff(oracle, () => {}, setBit0()), "vacuous: oracle changed no RAM");
  console.log("  EQUAL: loc_1c3a == oracle (RAM): arm bit -> 0x41c9=1, clear -> untouched (0)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const dropStore = (m) => {                                   // runs everything but the store
    driveSoundFrame(m);
    driveDecayingSoundSweep(m);
    m.mem8[0x7800];
    const in0 = m.mem8[0x6000];
    return requestSoundOnInput1AndContinueScan(m, in0);
  };
  const wrongVal = (m) => {                                    // stores 2, not 1
    driveSoundFrame(m);
    driveDecayingSoundSweep(m);
    m.mem8[0x7800];
    const in0 = m.mem8[0x6000];
    if (in0 & ARM_MASK) m.mem8[ARM] = 2;
    return requestSoundOnInput1AndContinueScan(m, in0);
  };
  const wrongCell = (m) => {                                   // stores to the neighbouring cell 0x41c8
    driveSoundFrame(m);
    driveDecayingSoundSweep(m);
    m.mem8[0x7800];
    const in0 = m.mem8[0x6000];
    if (in0 & ARM_MASK) m.mem8[0x41c8] = 1;
    return requestSoundOnInput1AndContinueScan(m, in0);
  };
  const invGate = (m) => {                                     // stores on the clear path
    driveSoundFrame(m);
    driveDecayingSoundSweep(m);
    m.mem8[0x7800];
    const in0 = m.mem8[0x6000];
    if (!(in0 & ARM_MASK)) m.mem8[ARM] = 1;
    return requestSoundOnInput1AndContinueScan(m, in0);
  };
  const dropSoundFrame = (m) => {                              // drops the sound-driver per-frame tick
    driveDecayingSoundSweep(m);
    m.mem8[0x7800];
    const in0 = m.mem8[0x6000];
    if (in0 & ARM_MASK) m.mem8[ARM] = 1;
    return requestSoundOnInput1AndContinueScan(m, in0);
  };
  const dropSweep = (m) => {                                   // drops the decaying sweep
    driveSoundFrame(m);
    m.mem8[0x7800];
    const in0 = m.mem8[0x6000];
    if (in0 & ARM_MASK) m.mem8[ARM] = 1;
    return requestSoundOnInput1AndContinueScan(m, in0);
  };
  const dropChain = (m) => {                                   // drops the input scan chain
    driveSoundFrame(m);
    driveDecayingSoundSweep(m);
    m.mem8[0x7800];
    const in0 = m.mem8[0x6000];
    if (in0 & ARM_MASK) m.mem8[ARM] = 1;
  };
  // dropSoundFrame is only observable through the tick's own shadows; poke them off their composed values.
  const sfEntry = () => seed(0x01, 0x01, (mem) => { mem[SND_FLAG] = 0xaa; mem[SND_PITCH] = 0x55; });

  assert.ok(ramDiff(oracle, noOp, setBit0()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, dropStore, setBit0()), "the dropped-store twin escaped");
  assert.ok(ramDiff(oracle, wrongVal, setBit0()), "the wrong-value twin escaped");
  assert.ok(ramDiff(oracle, wrongCell, setBit0()), "the wrong-cell twin escaped");
  assert.ok(ramDiff(oracle, invGate, clear0()), "the inverted-gate twin escaped");
  assert.ok(ramDiff(oracle, dropSoundFrame, sfEntry()), "the dropped-sound-frame twin escaped");
  assert.ok(ramDiff(oracle, dropSweep, sweepActive()), "the dropped-sweep twin escaped");
  assert.ok(ramDiff(oracle, dropChain, setBit0()), "the dropped-scan-chain twin escaped");
  console.log("  TEETH: no-op, drop-store, wrong-val, wrong-cell, inv-gate, drop-soundframe, drop-sweep, drop-chain all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["set", setBit0], ["clear", clear0]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x1c3a, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x1c3a, setBit0());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on set + clear; stack-adrift mutant refused");
});
