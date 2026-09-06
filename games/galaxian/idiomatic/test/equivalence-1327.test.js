// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1327 — memory-and-latch-equivalent to the frozen oracle at ROM 0x1327.
 * Per-frame ticker gated by bit 0 of the enable flag (0x4201). A prescaler (0x4205) fires once every ten
 * eligible frames; on each fire it enqueues a command word (opcode 2, current step) into the command queue
 * and steps the counter (0x4206) down. When the counter reaches zero the enable flag is cleared and sound
 * register 3 (0x6803 -> io.soundReg[3], a board latch NOT in the state dump) is silenced. Paths:
 *   DISABLED: bit 0 clear -> bail, nothing changes.
 *   EMIT: prescaler fires mid-sequence -> queue write + reload + counter tick.
 *   COMPLETE: last step -> enable cleared + sound register silenced.
 * EQUAL asserts ramDiff==null on all three AND io.soundReg[3] equality on complete. Teeth: a gate-ignoring
 * twin (disabled), a no-op and skip-enqueue twin (emit, RAM), and a latch no-op twin (complete, io).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { driveGatedSoundStepSequence as cand } from "../driveGatedSoundStepSequence.js";
import { loc_1327 as oracle } from "../../translated/loc_1327.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const ENABLE = 0x4201;
const PRESCALE = 0x4205;
const STEPS = 0x4206;
const SOUND_REG3 = 0x6803; // -> io.soundReg[3]
const HEAD = 0x40a0;       // command-queue write-head index
const QUEUE = 0x4000;      // queue page base

// Arm a free queue slot at the floor so an enqueue actually lands.
function armQueue(mem8) { mem8[HEAD] = 0xc0; mem8[QUEUE + 0xc0] = 0x80; }

const disabledEntry = () => craft((mem8, mm) => {
  mm.push16(0x9999);
  mem8[ENABLE] = 0x00; // bit 0 clear
  mem8[PRESCALE] = 7;  // must stay untouched
});

const emitEntry = () => craft((mem8, mm) => {
  mm.push16(0x9999);
  mem8[ENABLE] = 0x01;
  mem8[PRESCALE] = 1;  // dec -> 0 -> fire
  mem8[STEPS] = 3;     // emit, dec -> 2 (still running)
  armQueue(mem8);
});

const completeEntry = () => craft((mem8, mm) => {
  mm.push16(0x9999);
  mem8[ENABLE] = 0x01;
  mem8[PRESCALE] = 1;
  mem8[STEPS] = 1;     // emit, dec -> 0 -> finish
  armQueue(mem8);
  mm.mem.io.soundReg[3] = 0x55; // armed so silencing is observable
});

// The sound-register write is a board latch (not in dumpState); read it off the io device.
function reg3After(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m); return m.mem.io.soundReg[3];
}

test("EQUAL (crafted): loc_1327 == oracle bails on the closed enable gate", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, disabledEntry()), null, "loc_1327 diverged on the disabled path");
  const a = disabledEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PRESCALE], 7, "positive control: disabled -> prescaler untouched");
  console.log("  EQUAL: loc_1327 == oracle, disabled -> no tick");
});

test("EQUAL (crafted): loc_1327 == oracle emits a command word mid-sequence", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, emitEntry()), null, "loc_1327 diverged on the emit path");
  const a = emitEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[PRESCALE], 10, "positive control: prescaler reloaded");
  assert.equal(a.mem8[STEPS], 2, "positive control: step counter ticked");
  assert.equal(a.mem8[QUEUE + 0xc0], 2, "positive control: command opcode enqueued");
  assert.equal(a.mem8[QUEUE + 0xc1], 3, "positive control: step value enqueued");
  assert.equal(a.mem8[HEAD], 0xc2, "positive control: write-head advanced");
  console.log("  EQUAL: loc_1327 == oracle, command word emitted + counter ticked");
});

test("EQUAL (crafted): loc_1327 == oracle finishes the sequence and silences the latch", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, completeEntry()), null, "loc_1327 diverged on the complete path");
  assert.equal(reg3After(cand, completeEntry()), reg3After(oracle, completeEntry()), "sound-latch write diverged");
  const a = completeEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[ENABLE], 0, "positive control: enable flag cleared");
  assert.equal(reg3After(oracle, completeEntry()), 0, "positive control: sound register silenced");
  console.log("  EQUAL: loc_1327 == oracle, sequence finished (RAM + io.soundReg[3])");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const ignoreGate = (m) => { m.mem8[PRESCALE] = m.mem8[PRESCALE] - 1; };
  const noOp = () => {};
  // Reload + tick correctly but never enqueue -- proves the dissolved enqueue is checked.
  const skipEnqueue = (m) => {
    if ((m.mem8[ENABLE] & 1) === 0) return;
    m.mem8[PRESCALE] = m.mem8[PRESCALE] - 1;
    if (m.mem8[PRESCALE] !== 0) return;
    m.mem8[PRESCALE] = 10;
    m.mem8[STEPS] = m.mem8[STEPS] - 1;
  };
  const latchNoOp = (m) => { cand(m); m.mem.io.soundReg[3] = 0x55; };
  assert.ok(ramDiff(oracle, ignoreGate, disabledEntry()), "gate-ignoring twin escaped");
  assert.ok(ramDiff(oracle, noOp, emitEntry()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipEnqueue, emitEntry()), "skip-enqueue twin escaped");
  assert.notEqual(reg3After(latchNoOp, completeEntry()), reg3After(oracle, completeEntry()), "latch no-op twin escaped (io)");
  console.log("  TEETH: gate-ignoring, no-op, skip-enqueue (RAM) + latch no-op (io) all caught");
});
