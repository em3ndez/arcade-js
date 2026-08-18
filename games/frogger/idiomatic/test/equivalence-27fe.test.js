// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepDiveSurfaceTimer — memory-equivalent to the frozen oracle at ROM 0x27FE (the shared dive
 * surface-timer step). Idle (busy latch clear) returns; while 0x8146 != 0x8147 it steps the 0x8147
 * counter; once equal it decrements 0x8147 and copies the next anim frame from the alternate table
 * (gate bit0 == 0) or the main table (gate bit0 == 1). GATE: crafted-entry. Five states cover every arm.
 * RAM compared, stack masked (the oracle's nested calls leave dead slots). Teeth: no-op, a wrong-table
 * twin (proves the gate-bit selection), and a skip-decrement twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS } from "./_bootSetup.js";
import { stepDiveSurfaceTimer as cand } from "../stepDiveSurfaceTimer.js";
import { stepDiveFrameCounter } from "../stepDiveFrameCounter.js";
import { copyDiveAnimFrame } from "../copyDiveAnimFrame.js";
import { loc_27fe as oracle } from "../../translated/loc_27ea.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const BUSY = 0x814f, GATE = 0x8150, C6 = 0x8146, C7 = 0x8147, FRAME_IDX = 0x814e, COLUMN = 0x8145;
const VRAM = 0xa806, MAIN_TABLE = 0x1413;

const idle = () => craft((mem) => { mem[BUSY] = 0; mem[FRAME_IDX] = 0x33; mem[C7] = 0x44; });
const counterDec = () => craft((mem) => { mem[BUSY] = 1; mem[C6] = 0x40; mem[C7] = 0x05; mem[FRAME_IDX] = 0x07; });
const counterReload = () => craft((mem) => { mem[BUSY] = 1; mem[C6] = 0x40; mem[C7] = 0; mem[FRAME_IDX] = 0x07; });
const evenPhase = () => craft((mem) => { mem[BUSY] = 1; mem[C6] = 0x20; mem[C7] = 0x20; mem[GATE] = 0x02; mem[FRAME_IDX] = 0; mem[COLUMN] = 0; mem[VRAM] = 0; mem[VRAM + 1] = 0; });
const oddPhase = () => craft((mem) => { mem[BUSY] = 1; mem[C6] = 0x20; mem[C7] = 0x20; mem[GATE] = 0x03; mem[FRAME_IDX] = 0; mem[COLUMN] = 0; mem[VRAM] = 0; mem[VRAM + 1] = 0; });

test("EQUAL (crafted): stepDiveSurfaceTimer == oracle across idle/counter/even/odd", { skip }, () => {
  for (const [name, mk] of [["idle", idle], ["counter-dec", counterDec], ["counter-reload", counterReload], ["even-phase", evenPhase], ["odd-phase", oddPhase]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  let a = idle(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[FRAME_IDX], 0x33, "control: idle path changes nothing");
  a = counterDec(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[C7], 0x04, "control: unaligned path steps the 0x8147 counter (5->4)");
  assert.equal(a.mem8[FRAME_IDX], 0x07, "control: unaligned path does NOT copy a frame");
  a = counterReload(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[C7], 0x40, "control: unaligned+drained reloads 0x8147 from 0x8146");
  a = evenPhase(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[C7], 0x1f, "control: aligned path decrements 0x8147 (0x20->0x1f)");
  assert.equal(a.mem8[VRAM], 0x5c, "control: even phase copies from the alternate table 0x1403");
  a = oddPhase(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[VRAM], 0x10, "control: odd phase copies from the main table 0x1413");
  console.log("  EQUAL: idle/counter-dec/counter-reload/even/odd; controls asserted");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTable = (m) => { // always main table -> wrong on the even phase
    const { mem8 } = m;
    if (mem8[BUSY] === 0) return;
    if (mem8[C6] !== mem8[C7]) return stepDiveFrameCounter(m, C7);
    mem8[C7] = (mem8[C7] - 1) & 0xff;
    return copyDiveAnimFrame(m, MAIN_TABLE);
  };
  const skipDec = (m) => { // omits the 0x8147 decrement on the aligned path
    const { mem8 } = m;
    if (mem8[BUSY] === 0) return;
    if (mem8[C6] !== mem8[C7]) return stepDiveFrameCounter(m, C7);
    return copyDiveAnimFrame(m, MAIN_TABLE);
  };
  assert.ok(ramDiff(oracle, noOp, evenPhase()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTable, evenPhase()), "wrong-table twin escaped");
  assert.ok(ramDiff(oracle, skipDec, evenPhase()), "skip-decrement twin escaped");
  console.log("  TEETH: no-op, wrong-table, skip-decrement all caught");
});
