// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0614 — memory-equivalent to the frozen oracle at ROM 0x0614. A state-timer handler; whole contract
 * is RAM. Two paths:
 *   - RUNNING: state timer > 1 -> tick it and return (no setup work).
 *   - EXPIRY: timer == 1 -> reload it, advance the step, seed the active flag + reference X, refill the
 *     sub-counter block from its reload table, clear two scratch cells, and queue two command words.
 * No register/io live-out — the tail enqueue's HL restore is an internal artifact. EQUAL asserts
 * ramDiff==null on both paths. Teeth: no-op + decrement-by-two (running); no-op, no-reload, a mangled
 * copy byte, and a scribble (expiry).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0614 as cand } from "../loc_0614.js";
import { loc_0614 as oracle } from "../../translated/loc_0614.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TIMER = 0x4009;
const SEQ = 0x400a;
const ACTIVE = 0x4200;
const REF_X = 0x4202;
const SRC = 0x15e3;      // sub-counter reload table
const DST = 0x424a;      // sub-counter block
const SCR0 = 0x4058;
const SCR1 = 0x405a;
const QHEAD = 0x40a0;
const QSLOT0 = 0x40c0;
const SCRATCH = 0x4300;  // a plain work-RAM cell for the ramDiff-teeth twin

// Timer still running: tick and return before any setup.
const running = () => craft((mem, mm) => { mm.push16(0x9999); mem[TIMER] = 3; });
// Timer about to expire: full setup + two queue appends. Queue slots armed free.
const expiry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[TIMER] = 1;
  mem[SEQ] = 6;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff;
});

test("EQUAL (crafted): loc_0614 == oracle while the timer is still running", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, running()), null, "loc_0614 diverged on the running path");
  const a = running(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TIMER], 2, "positive control: oracle did not tick the timer 3->2");
  console.log("  EQUAL: loc_0614 == oracle (RAM), timer 3->2, no setup");
});

test("EQUAL (crafted): loc_0614 == oracle on timer expiry (full setup + queue append)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expiry()), null, "loc_0614 diverged on the expiry path");
  const a = expiry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TIMER], 0x0a, "positive control: timer not reloaded to 0x0a");
  assert.equal(a.mem8[SEQ], 7, "positive control: sequence step not advanced 6->7");
  assert.equal(a.mem8[ACTIVE], 1, "positive control: active flag lo not seeded to 1");
  assert.equal(a.mem8[ACTIVE + 1], 0, "positive control: active flag hi not cleared");
  assert.equal(a.mem8[REF_X], 0x80, "positive control: reference X not seeded to 0x80");
  assert.equal(a.mem8[DST], a.mem8[SRC], "positive control: sub-counter byte 0 not copied");
  assert.equal(a.mem8[DST + 15], a.mem8[SRC + 15], "positive control: sub-counter byte 15 not copied");
  assert.equal(a.mem8[SCR0], 0, "positive control: scratch cell 0 not cleared");
  assert.equal(a.mem8[SCR1], 0, "positive control: scratch cell 1 not cleared");
  assert.equal(a.mem8[QSLOT0], 0x07, "positive control: first cue hi (7) not queued");
  assert.equal(a.mem8[QSLOT0 + 1], 0x03, "positive control: first cue lo (3) not queued");
  assert.equal(a.mem8[QSLOT0 + 2], 0x02, "positive control: second cue hi (2) not queued");
  assert.equal(a.mem8[QSLOT0 + 3], 0x00, "positive control: second cue lo (0) not queued");
  assert.equal(a.mem8[QHEAD], 0xc4, "positive control: write-head not advanced past both appends");
  console.log("  EQUAL: loc_0614 == oracle (RAM), full setup + two cues queued");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const decTwice = (m) => { m.mem8[TIMER] = (m.mem8[TIMER] - 2) & 0xff; };
  const noReload = (m) => { cand(m); m.mem8[TIMER] = 1; };
  const mangleCopy = (m) => { cand(m); m.mem8[DST] = m.mem8[DST] ^ 0xff; };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] = m.mem8[SCRATCH] ^ 0xff; };
  assert.ok(ramDiff(oracle, noOp, running()), "the no-op twin escaped (running)");
  assert.ok(ramDiff(oracle, decTwice, running()), "the decrement-by-two twin escaped (running)");
  assert.ok(ramDiff(oracle, noOp, expiry()), "the no-op twin escaped (expiry)");
  assert.ok(ramDiff(oracle, noReload, expiry()), "the no-reload twin escaped (expiry)");
  assert.ok(ramDiff(oracle, mangleCopy, expiry()), "the mangled-copy twin escaped (expiry)");
  assert.ok(ramDiff(oracle, scribble, expiry()), "the scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: running no-op/dec-twice + expiry no-op/no-reload/mangled-copy/scribble caught");
});
