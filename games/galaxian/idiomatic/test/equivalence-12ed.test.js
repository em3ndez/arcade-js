// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_12ed — crafted-entry equivalence vs the frozen event-consumer at ROM 0x12ed. Two paths with
 * different live-outs:
 *   EVENT (HIT_EVENT_FLAG 0x4204 bit0 set): clears the flag, resets the object-active pair
 *     (0x4200=0/0x4201=1), arms the two pulse counters (0x4205=10/0x4206=4), enqueues the hit-sound
 *     command word, ticks the 0x421a countdown (floored at 0) and the [0,5] 0x421d cycle, and — with the
 *     mode bit 0x4006 bit0 set — raises SOUND_W_REG3 (0x6803 -> io.soundReg[3], a board latch NOT in the
 *     state dump, so ramDiff is blind to it). EQUAL asserts ramDiff==null AND io.soundReg[3] matches.
 *   NO EVENT (0x4204 bit0 clear): returns immediately -> no RAM, no latch write.
 * Teeth: a no-op and a wrong-RAM twin (caught by ramDiff) plus a latch-skipping twin whose RAM matches
 * the oracle exactly and is caught ONLY by the io.soundReg[3] observation. The return-stack window is
 * masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_12ed as cand } from "../loc_12ed.js";
import { loc_12ed as oracle } from "../../translated/loc_12ed.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const HIT_EVENT_FLAG = 0x4204; // bit0 gates the whole routine
const OBJ_ACTIVE_LO = 0x4200;  // reset to 0
const OBJ_ACTIVE_HI = 0x4201;  // reset to 1
const PULSE_A = 0x4205;        // armed to 10
const PULSE_B = 0x4206;        // armed to 4
const COUNTDOWN = 0x421a;      // activity countdown, floored at 0
const CYCLE = 0x421d;          // [0,5] cycle counter
const MODE_FLAG = 0x4006;      // bit0 -> raise the sound latch
const SOUND3 = 3;              // io.soundReg index for SOUND_W_REG3 (0x6803)
const SENTINEL = 0x55;         // seeded into the sound latch so a write (or its absence) is observable

// EVENT pending, mode bit set: full consume path -> RAM reset + sound latch raised.
const eventEntry = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[HIT_EVENT_FLAG] = 0x01;
  mem[MODE_FLAG] = 0x01;
  mem[OBJ_ACTIVE_LO] = 0xff; // seed non-target values so the oracle's resets are observable
  mem[OBJ_ACTIVE_HI] = 0xff;
  mem[PULSE_A] = 0xff;
  mem[PULSE_B] = 0xff;
  mem[COUNTDOWN] = 3;        // nonzero -> ticks to 2
  mem[CYCLE] = 3;            // dec -> 2, stays in [0,5]
  m.mem.io.soundReg[SOUND3] = SENTINEL;
});

// NO EVENT: bit0 clear -> immediate ret, nothing touched.
const noEventEntry = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[HIT_EVENT_FLAG] = 0x00;
  mem[MODE_FLAG] = 0x01; // set, to prove the guard (not the mode bit) is what makes it a no-op
  m.mem.io.soundReg[SOUND3] = SENTINEL;
});

// The sound latch is a board device (not in dumpState); read it off the io device.
function reg3After(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m);
  return m.mem.io.soundReg[SOUND3];
}

test("EQUAL (crafted): loc_12ed consumes the event and raises the sound latch like the oracle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, eventEntry()), null, "loc_12ed diverged on the event path (RAM)");
  assert.equal(reg3After(cand, eventEntry()), reg3After(oracle, eventEntry()), "sound-latch write diverged");
  const a = eventEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[HIT_EVENT_FLAG], 0, "positive control: oracle cleared the event flag");
  assert.equal(a.mem8[OBJ_ACTIVE_LO], 0, "positive control: oracle reset the object-active low byte");
  assert.equal(a.mem8[OBJ_ACTIVE_HI], 1, "positive control: oracle set the object-active high byte");
  assert.equal(a.mem8[PULSE_A], 10, "positive control: oracle armed pulse counter 0x4205=10");
  assert.equal(a.mem8[PULSE_B], 4, "positive control: oracle armed pulse counter 0x4206=4");
  assert.equal(a.mem8[COUNTDOWN], 2, "positive control: oracle ticked the activity countdown 3->2");
  assert.equal(a.mem8[CYCLE], 2, "positive control: oracle cycled 0x421d 3->2 (in [0,5])");
  assert.equal(reg3After(oracle, eventEntry()), 1, "positive control: oracle raised sound_w reg3 (0x6803)=1");
  console.log("  EQUAL: loc_12ed == oracle on the event path (RAM + io.soundReg[3])");
});

test("EQUAL (crafted): loc_12ed is a no-op when no event is pending", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, noEventEntry()), null, "loc_12ed diverged on the no-event path (RAM)");
  assert.equal(reg3After(cand, noEventEntry()), reg3After(oracle, noEventEntry()), "sound-latch diverged on the no-op");
  const a = noEventEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[HIT_EVENT_FLAG], 0, "positive control: event flag stays clear");
  assert.equal(reg3After(oracle, noEventEntry()), SENTINEL, "positive control: the no-op writes no sound latch");
  assert.equal(reg3After(cand, noEventEntry()), SENTINEL, "candidate raised the latch on the no-op path");
  console.log("  EQUAL: loc_12ed == oracle on the no-event path (RAM, no sound write)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongRam = (m) => { cand(m); m.mem8[PULSE_A] = 0; };                  // corrupts an armed counter -> ramDiff bites
  const skipLatch = (m) => { cand(m); m.mem.io.soundReg[SOUND3] = SENTINEL; }; // all RAM correct, latch left unraised

  assert.ok(ramDiff(oracle, noOp, eventEntry()), "the no-op twin escaped (event RAM)");
  assert.ok(ramDiff(oracle, wrongRam, eventEntry()), "the wrong-RAM twin escaped (ramDiff)");
  // The latch-skip twin's RAM is identical to the oracle's -> ramDiff is blind; only the io read catches it.
  assert.equal(ramDiff(oracle, skipLatch, eventEntry()), null, "control: latch-skip twin's RAM matches (ramDiff blind to the latch)");
  assert.notEqual(reg3After(skipLatch, eventEntry()), reg3After(oracle, eventEntry()), "the latch-skip twin escaped (io)");
  console.log("  TEETH: no-op, wrong-RAM (ramDiff) + latch-skip (io-only) all caught");
});
