// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0722 — equivalent to the frozen oracle at ROM 0x0722.
 * Two paths keyed on mode flag 0x4006 bit0:
 *   - CLEAR: advance the sub-state counter at HL (=0x400a) and reload the dwell timer 0x4009=0x50.
 *   - SET: reset to state 1 — game-state 0x4005=1, clear 0x4006 and 0x400a, silence the sound hardware
 *     (which also drives irqEnable/starsEnable to 0 — board latches, NOT in the state dump), and enqueue
 *     a command word into the queue.
 * The work-RAM live-outs (counter, dwell, state cells, queue) are asserted via ramDiff==null; the io
 * latches driven low by the silence step are asserted on m.mem.io directly. Teeth: no-op twins on both
 * paths (RAM) and a silence-skipping twin (io).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0722 as cand } from "../loc_0722.js";
import { loc_0722 as oracle } from "../../translated/loc_0722.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const MODE_FLAG = 0x4006;
const GAME_STATE = 0x4005;
const SEQUENCE_STATE = 0x400a;
const DWELL = 0x4009;
const QUEUE_HEAD = 0x40a0;
const QUEUE_SLOT = 0x40c0;

// Mode bit clear: advance the sub-state counter (HL=0x400a) and reload the dwell timer.
const advanceEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SEQUENCE_STATE;
  mem[MODE_FLAG] = 0; mem[SEQUENCE_STATE] = 5; mem[DWELL] = 0;
});
// Mode bit set: reset to state 1, silence sound, enqueue. Free the queue slot so the enqueue is visible.
const resetEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = SEQUENCE_STATE;
  mem[MODE_FLAG] = 1; mem[GAME_STATE] = 0; mem[SEQUENCE_STATE] = 7;
  mem[QUEUE_HEAD] = 0xc0; mem[QUEUE_SLOT] = 0x80;
  mm.mem.io.irqEnable = 1; mm.mem.io.starsEnable = 1;
});

// Read the interrupt/stars latches after running fn from entry (board latches, not in dumpState).
function latchesAfter(fn, entry) {
  const m = entry.clone(); m.routines = STUBS; fn(m);
  return { irq: m.mem.io.irqEnable, stars: m.mem.io.starsEnable };
}

test("EQUAL (crafted): loc_0722 == oracle advances the sub-state on the clear mode flag", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, advanceEntry()), null, "loc_0722 diverged on the advance path");
  const a = advanceEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SEQUENCE_STATE], 6, "positive control: oracle bumped the sub-state counter");
  assert.equal(a.mem8[DWELL], 0x50, "positive control: oracle reloaded the dwell timer");
  console.log("  EQUAL: mode clear -> sub-state 5->6, dwell 0x50, == oracle");
});

test("EQUAL (crafted): loc_0722 == oracle resets and silences on the set mode flag", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, resetEntry()), null, "loc_0722 diverged on the reset path (RAM)");
  const candL = latchesAfter(cand, resetEntry());
  const oracleL = latchesAfter(oracle, resetEntry());
  assert.deepEqual(candL, oracleL, "loc_0722 io latches diverged");
  assert.deepEqual(oracleL, { irq: 0, stars: 0 }, "positive control: oracle silenced the io latches");
  const a = resetEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GAME_STATE], 1, "positive control: oracle set game-state 1");
  assert.equal(a.mem8[MODE_FLAG], 0, "positive control: oracle cleared the mode flag");
  assert.equal(a.mem8[SEQUENCE_STATE], 0, "positive control: oracle cleared the sequence state");
  assert.equal(a.mem8[QUEUE_SLOT], 6, "positive control: oracle enqueued the command word hi byte (6)");
  console.log("  EQUAL: mode set -> reset+silence+enqueue, == oracle (RAM + io)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  // Does all of the reset path's RAM work but skips the silence step (re-arms the latches).
  const skipSilence = (m) => { cand(m); m.mem.io.irqEnable = 1; m.mem.io.starsEnable = 1; };
  assert.ok(ramDiff(oracle, noOp, advanceEntry()), "the no-op twin escaped on the advance path");
  assert.ok(ramDiff(oracle, noOp, resetEntry()), "the no-op twin escaped on the reset path");
  const twinL = latchesAfter(skipSilence, resetEntry());
  const oracleL = latchesAfter(oracle, resetEntry());
  assert.notDeepEqual(twinL, oracleL, "the silence-skipping twin escaped (io)");
  console.log("  TEETH: no-op (RAM, both paths) and silence-skip (io) caught");
});
