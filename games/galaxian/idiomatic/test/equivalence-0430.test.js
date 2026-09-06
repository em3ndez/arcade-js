// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0430 — crafted-entry equivalence vs the frozen state handler at ROM 0x0430, with its two calls
 * dissolved to the decompiled lamp driver and memory-fill primitives. Two paths:
 *   - EXPIRE: countdown 0x4019 hits 0 -> advance SEQUENCE_STATE (0x400a) and zero the flag block
 *     (0x4100-0x417f). All live-outs are RAM, so EQUAL asserts ramDiff==null.
 *   - COUNTING: countdown stays nonzero -> drive the start-button lamps (0x6000/0x6001 -> io.startLamp,
 *     board latches NOT in the state dump). So EQUAL asserts ramDiff==null (only 0x4019 moves) AND the
 *     lamp latches match. Teeth: a no-op, a fill-skipping and a state-skipping twin on the expire path;
 *     a lamp-skipping twin on the counting path. The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { holdStartLampsThenAdvanceSequence as cand } from "../holdStartLampsThenAdvanceSequence.js";
import { loc_0430 as oracle } from "../../translated/loc_0430.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const COUNTDOWN = 0x4019;
const SEQ_STATE = 0x400a;
const FLAG_BASE = 0x4100;
const FLAG_COUNT = 128;
const LAMP0 = 0x6000;
const LAMP1 = 0x6001;
const LAMP_GATE = 0x425f; // bit5 enables the lamps
const CREDITS = 0x4002;
const DIRTY = 0xee;       // pre-poked into the flag block so the fill is demonstrable

// Countdown at 1: this tick expires it -> state advance + flag-block fill.
const expire = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[COUNTDOWN] = 1;
  mem[SEQ_STATE] = 5;
  for (let i = 0; i < FLAG_COUNT; i++) mem[FLAG_BASE + i] = DIRTY;
  mem[FLAG_BASE + FLAG_COUNT] = DIRTY; // one byte past the block, so "the fill stops here" is a real control
});

// Countdown at 3: still counting -> lamps driven; gate open, two credits -> both lamps on.
const counting = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[COUNTDOWN] = 3;
  mem[LAMP_GATE] = 0x20;
  mem[CREDITS] = 2;
  mem[LAMP0] = 0; // force both lamps off so lighting them is observable
  mem[LAMP1] = 0;
});

// The lamp latches are board devices (not in dumpState); read them off the io device.
function lampsAfter(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m);
  return [m.mem.io.startLamp[0], m.mem.io.startLamp[1]];
}

test("EQUAL (crafted): loc_0430 == oracle expires the countdown -> state + flag-block fill", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expire()), null, "loc_0430 diverged on the expire path");
  const a = expire(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[COUNTDOWN], 0, "control: countdown reached 0");
  assert.equal(a.mem8[SEQ_STATE], 6, "control: sequence state advanced");
  assert.equal(a.mem8[FLAG_BASE], 0, "control: flag block cleared (first)");
  assert.equal(a.mem8[FLAG_BASE + FLAG_COUNT - 1], 0, "control: flag block cleared (last)");
  assert.equal(a.mem8[FLAG_BASE + FLAG_COUNT], DIRTY, "control: fill stopped at the block end");
  console.log("  EQUAL: loc_0430 == oracle (RAM), countdown 1->0, state advanced, flag block cleared");
});

test("EQUAL (crafted): loc_0430 == oracle keeps counting -> drives the start lamps", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, counting()), null, "loc_0430 diverged on the counting path");
  assert.deepEqual(lampsAfter(cand, counting()), lampsAfter(oracle, counting()), "lamp latches disagree");
  const a = counting(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[COUNTDOWN], 2, "control: countdown ticked to 2");
  assert.deepEqual(lampsAfter(oracle, counting()), [1, 1], "control: two credits light both lamps");
  console.log("  EQUAL: loc_0430 == oracle (RAM + io.startLamp), countdown 3->2, both lamps on");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipFill = (m) => {
    const r = (m.mem8[COUNTDOWN] - 1) & 0xff;
    m.mem8[COUNTDOWN] = r;
    if (r !== 0) return;
    m.mem8[SEQ_STATE] = m.mem8[SEQ_STATE] + 1; // advances state but never clears the flag block
  };
  const skipState = (m) => { cand(m); m.mem8[SEQ_STATE] = 5; }; // undo the state advance
  const noLamps = (m) => { const r = (m.mem8[COUNTDOWN] - 1) & 0xff; m.mem8[COUNTDOWN] = r; }; // tick, no lamps

  assert.ok(ramDiff(oracle, noOp, expire()), "the no-op twin escaped (expire)");
  assert.ok(ramDiff(oracle, skipFill, expire()), "the fill-skipping twin escaped");
  assert.ok(ramDiff(oracle, skipState, expire()), "the state-skipping twin escaped");
  assert.notDeepEqual(lampsAfter(noLamps, counting()), lampsAfter(oracle, counting()), "the lamp-skipping twin escaped (io)");
  console.log("  TEETH: no-op, fill-skip, state-skip (RAM), lamp-skip (io) all caught");
});
