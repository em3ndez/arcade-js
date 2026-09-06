// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16f5 — crafted-entry equivalence vs the frozen translated oracle at ROM 0x16f5 (the sound driver's
 * per-frame tick). The routine clears the composite flag byte (0x41c0) and primes the pitch shadow (0x41c1)
 * high, runs the seven channel/effect updaters, then LATCHES the composed bytes to the sound hardware:
 * composite -> sound register 6, its rotate-right -> register 7, pitch shadow -> the pitch latch.
 *
 * Those three latch writes go to board sound devices (soundReg[6]/[7], soundPitchVal) that DO NOT appear in
 * the state dump, so ramDiff is blind to them — a wrong rotate or a dropped latch passes eq-green. EQUAL is
 * therefore asserted on the observable io state (a standing side-channel/"register" comparison arm) AND on
 * ramDiff (the composite/pitch shadows + the updaters' work RAM). Two entries: a plain attract seed (all
 * updaters idle -> composite 0) and one with the sound-sequence channels armed (a channel stages composite
 * 2 -> reg6=2, reg7=rrca(2)=1), the latter chosen so the rotate is asymmetric (rrca 1 != rlca 4 != 2) and
 * the reg7 tooth can bite. Teeth: io no-op, wrong reg6, wrong rotate (rlca not rrca), wrong pitch; plus a
 * ram-scribble twin proving ramDiff still has teeth. NOT dispatching (calls its updaters and returns), so
 * no SP-seam tooth.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { driveSoundFrame as cand } from "../driveSoundFrame.js";
import { loc_16f5 as oracle } from "../../translated/loc_16f5.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const COMPOSITE = 0x41c0; // composite flag byte, latched to sound register 6
const PITCH = 0x41c1;     // pitch shadow, latched to the pitch device
const SCRATCH_RAM = 0x4180; // a plain work-RAM cell for the ramDiff-teeth twin
// sound-sequence channel descriptors advanceAllSoundSequenceChannels ticks; arming one stages composite=2.
const SEQ_ACTIVE = 0x41cd, SEQ_CH1 = 0x41cf, SEQ_CH2 = 0x41d2;

const IO_SENTINEL = 9; // seed the latches away from any target so each latch write is an observable change.

// A plain attract seed: every updater idle -> composite stays 0 -> reg6=reg7=0. IO pre-seeded off-target.
const idle = () => craft((mem8, m) => {
  m.push16(0x9999);
  m.io.soundReg[6] = IO_SENTINEL; m.io.soundReg[7] = IO_SENTINEL; m.io.soundPitchVal = IO_SENTINEL;
});

// Sound-sequence channels armed: a channel stages composite=2 -> reg6=2, reg7=rrca(2)=1. IO off-target.
const seqArmed = () => craft((mem8, m) => {
  m.push16(0x9999);
  mem8[SEQ_ACTIVE] = 1; mem8[SEQ_CH1] = 1; mem8[SEQ_CH2] = 1;
  m.io.soundReg[6] = IO_SENTINEL; m.io.soundReg[7] = IO_SENTINEL; m.io.soundPitchVal = IO_SENTINEL;
});

// The latch live-out is board sound devices (not in dumpState); snapshot them off the io device.
function ioAfter(fn, entry) {
  const m = entry.clone(); m.routines = STUBS; fn(m);
  return { reg6: m.io.soundReg[6], reg7: m.io.soundReg[7], pitch: m.io.soundPitchVal };
}

function rlca(x) { return ((x << 1) | ((x >> 7) & 1)) & 0xff; } // the WRONG rotate (left, not right)

test("EQUAL (crafted): loc_16f5 latches sound like the oracle (io side-channel + RAM)", { skip }, () => {
  for (const [name, e] of [["idle", idle], ["seqArmed", seqArmed]]) {
    assert.deepEqual(ioAfter(cand, e()), ioAfter(oracle, e()), `loc_16f5 io diverged on the ${name} entry`);
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_16f5 wrote RAM the oracle did not (${name})`);
  }
  // Positive controls: the oracle actually drives the latches (non-vacuous), and the armed entry is asymmetric.
  assert.deepEqual(ioAfter(oracle, idle()), { reg6: 0, reg7: 0, pitch: 255 }, "control: idle latch");
  assert.deepEqual(ioAfter(oracle, seqArmed()), { reg6: 2, reg7: 1, pitch: 0 }, "control: armed latch reg6=2,reg7=rrca(2)=1");
  console.log("  EQUAL: idle -> reg6=0,reg7=0,pitch=255; armed -> reg6=2,reg7=1(rrca),pitch=0; RAM matches");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const oref = ioAfter(oracle, seqArmed());
  const noOp = () => {};
  const wrongReg6 = (m) => { cand(m); m.io.soundReg[6] = (m.io.soundReg[6] ^ 0xff) & 0xff; };
  const wrongRotate = (m) => { cand(m); m.io.soundReg[7] = rlca(m.mem8[COMPOSITE]); }; // rlca not rrca
  const wrongPitch = (m) => { cand(m); m.io.soundPitchVal = (m.io.soundPitchVal ^ 0xff) & 0xff; };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH_RAM] = m.mem8[SCRATCH_RAM] ^ 0xff; };

  assert.notDeepEqual(ioAfter(noOp, seqArmed()), oref, "no-op twin escaped (io)");
  assert.notDeepEqual(ioAfter(wrongReg6, seqArmed()), oref, "wrong-reg6 twin escaped (io)");
  assert.notDeepEqual(ioAfter(wrongRotate, seqArmed()), oref, "wrong-rotate (rlca) twin escaped (io)");
  assert.notDeepEqual(ioAfter(wrongPitch, seqArmed()), oref, "wrong-pitch twin escaped (io)");
  assert.ok(ramDiff(oracle, scribble, seqArmed()), "scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: io no-op + wrong-reg6 + wrong-rotate + wrong-pitch caught, ramDiff scribble caught");
});
