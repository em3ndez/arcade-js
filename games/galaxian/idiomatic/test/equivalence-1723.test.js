// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1723 — crafted-entry equivalence vs the frozen tone phase-counter at ROM 0x1723.
 * Two paths with different live-outs:
 *   ACTIVE (phase counter not one-from-expiry): delegates to the tone driver — decrements the tone
 *     duration (0x41ce, RAM) and writes the toggled level to sound register 5 (0x6805 -> io.soundReg[5],
 *     a board latch NOT in the state dump); the phase counter itself is left untouched.
 *   EXPIRY (counter one-from-expiry): parks the counter at 0 and re-arms the duration to 8 (RAM only).
 * EQUAL asserts ramDiff==null on both AND io.soundReg[5] on the active path; observing io is required
 * since the tone write never reaches the state dump. Teeth: no-op, a phase-counter scribble (the active
 * path must not touch it) and an io-corrupt twin on the active path; no-op and a gate-ignoring twin on
 * the expiry path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_1723 as cand } from "../loc_1723.js";
import { loc_1723 as oracle } from "../../translated/loc_1723.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PHASE = 0x41cc;      // phase counter
const DURATION = 0x41ce;   // tone duration (re-armed to 8 on expiry)
const FRAME_FLAG = 0x4007; // toggled into the tone level
const SOUND5_ADDR = 0x6805; // -> io.soundReg[5]
const SOUND5 = 5;          // io.soundReg index for the sound-write latch above
const SENTINEL = 0x55;     // seeded into the sound latch to make a write (or its absence) observable

// ACTIVE: counter far from expiry, duration running, frame flag clear -> level 1.
const activeEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[PHASE] = 5;
  mem[DURATION] = 8;
  mem[FRAME_FLAG] = 0x00;
  mm.mem.io.soundReg[SOUND5] = SENTINEL;
});
// EXPIRY: counter one-from-expiry (1) -> re-arm branch, no sound write.
const expiryEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[PHASE] = 1;
  mem[DURATION] = 3;
  mm.mem.io.soundReg[SOUND5] = SENTINEL;
});

function reg5After(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m); return m.mem.io.soundReg[SOUND5];
}

test("EQUAL (crafted): loc_1723 drives the tone on the active path like the oracle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, activeEntry()), null, "loc_1723 diverged on the active path (RAM)");
  assert.equal(reg5After(cand, activeEntry()), reg5After(oracle, activeEntry()), "sound-reg write diverged");
  const a = activeEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DURATION], 7, "positive control: oracle counted one off the duration");
  assert.equal(a.mem8[PHASE], 5, "positive control: active path leaves the phase counter alone");
  assert.equal(reg5After(oracle, activeEntry()), 1, "positive control: oracle wrote the toggled level");
  console.log("  EQUAL: loc_1723 == oracle on the active path (RAM + io.soundReg[5])");
});

test("EQUAL (crafted): loc_1723 re-arms on the expiry path like the oracle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expiryEntry()), null, "loc_1723 diverged on the expiry path");
  const a = expiryEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PHASE], 0, "positive control: oracle parked the phase counter at 0");
  assert.equal(a.mem8[DURATION], 8, "positive control: oracle re-armed the duration to 8");
  assert.equal(reg5After(oracle, expiryEntry()), SENTINEL, "positive control: expiry path writes no sound");
  assert.equal(reg5After(cand, expiryEntry()), SENTINEL, "candidate wrote sound on the expiry path");
  console.log("  EQUAL: loc_1723 == oracle on the expiry path (RAM, no sound write)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const touchCounter = (m) => { cand(m); m.mem8[PHASE] = 0; };            // active path must not write it
  const corruptIo = (m) => { cand(m); m.mem8[SOUND5_ADDR] = 0; }; // silences the toggled tone (wrong)
  const ignoreGate = (m) => { m.mem8[DURATION] = (m.mem8[DURATION] - 1) & 0xff; }; // no re-arm on expiry
  assert.ok(ramDiff(oracle, noOp, activeEntry()), "no-op twin escaped (active RAM)");
  assert.ok(ramDiff(oracle, touchCounter, activeEntry()), "phase-scribble twin escaped (active)");
  assert.notEqual(reg5After(corruptIo, activeEntry()), reg5After(oracle, activeEntry()), "io twin escaped");
  assert.ok(ramDiff(oracle, noOp, expiryEntry()), "no-op twin escaped (expiry RAM)");
  assert.ok(ramDiff(oracle, ignoreGate, expiryEntry()), "gate-ignoring twin escaped (expiry)");
  console.log("  TEETH: active no-op/phase-scribble/io + expiry no-op/gate-ignore all caught");
});
