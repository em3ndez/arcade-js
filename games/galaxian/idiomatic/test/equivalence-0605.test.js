// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0605 — crafted-entry equivalence vs the frozen state-timer handler at ROM 0x0605, with its tail
 * jump dissolved to the decompiled command-queue enqueue. Two paths:
 *   - EXPIRE: timer 0x4009 hits 0 -> reload it (0x14), advance SEQUENCE_STATE (0x400a), and enqueue the
 *     word 0x0682 into the command queue (0x40a0 write-head + the 0x40xx slots).
 *   - COUNTING: timer stays nonzero -> only the timer moves.
 * Every live-out is work RAM, so EQUAL asserts ramDiff==null on both paths (plus positive controls).
 * Teeth: a no-op, a wrong-reload and a queue-scribble twin. The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { advanceSubstateAfterDwellAndQueue as cand } from "../advanceSubstateAfterDwellAndQueue.js";
import { loc_0605 as oracle } from "../../translated/loc_0605.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TIMER = 0x4009;
const SEQ_STATE = 0x400a;
const QUEUE_HEAD = 0x40a0;
const QUEUE_BASE = 0x4000;
const HEAD_START = 0xc0;
const SLOT0 = QUEUE_BASE + HEAD_START; // 0x40c0
const SLOT1 = SLOT0 + 1;               // 0x40c1
const RELOAD = 0x14;

// Timer at 1: this tick expires it -> reload + state advance + enqueue. Head slot armed free (bit7).
const expire = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[TIMER] = 1;
  mem[SEQ_STATE] = 5;
  mem[QUEUE_HEAD] = HEAD_START;
  mem[SLOT0] = 0x80; // slot free
  mem[SLOT1] = 0x00;
});

// Timer at 3: still counting -> only the timer moves.
const counting = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[TIMER] = 3;
});

test("EQUAL (crafted): loc_0605 == oracle expires the timer -> reload + state + enqueue", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expire()), null, "loc_0605 diverged on the expire path");
  const a = expire(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TIMER], RELOAD, "control: timer reloaded");
  assert.equal(a.mem8[SEQ_STATE], 6, "control: sequence state advanced");
  assert.equal(a.mem8[SLOT0], 0x06, "control: command word hi byte enqueued");
  assert.equal(a.mem8[SLOT1], 0x82, "control: command word lo byte enqueued");
  assert.equal(a.mem8[QUEUE_HEAD], (HEAD_START + 2) & 0xff, "control: write-head advanced two");
  console.log("  EQUAL: loc_0605 == oracle (RAM), timer reloaded, state advanced, word enqueued");
});

test("EQUAL (crafted): loc_0605 == oracle keeps counting -> only the timer moves", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, counting()), null, "loc_0605 diverged on the counting path");
  const a = counting(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TIMER], 2, "control: timer ticked to 2");
  assert.equal(a.mem8[SEQ_STATE], counting().mem8[SEQ_STATE], "control: state untouched while counting");
  console.log("  EQUAL: loc_0605 == oracle (RAM), timer 3->2, nothing else moved");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongReload = (m) => { cand(m); m.mem8[TIMER] = 0x13; };            // reload off by one
  const scribbleQueue = (m) => { cand(m); m.mem8[SLOT0] = m.mem8[SLOT0] ^ 0xff; }; // queue in the diff

  assert.ok(ramDiff(oracle, noOp, expire()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongReload, expire()), "the wrong-reload twin escaped");
  assert.ok(ramDiff(oracle, scribbleQueue, expire()), "the queue-scribble twin escaped");
  console.log("  TEETH: no-op, wrong-reload, queue-scribble all caught");
});
