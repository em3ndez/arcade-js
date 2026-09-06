// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_10c2 — equivalent to the frozen oracle. Per-object step keyed on IX: bumps the object's tick counter
 * and counts down its dwell timer. RUN path (timer>1 after the decrement): only the counter + timer.
 * EXPIRE path (timer==1): also queues a command word (its param = payload selector + 0x4b) and advances the
 * state. Every live-out is work RAM -> ramDiff. Teeth: no-op, a wrong-timer scribble (run), a wrong-param
 * scribble (expire). The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_10c2 as cand } from "../loc_10c2.js";
import { loc_10c2 as oracle } from "../../translated/loc_10c2.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x4260; // object record base (IX)
const TICK = OBJ + 4, TIMER = OBJ + 16, SELECTOR = OBJ + 7, STATE = OBJ + 2;
const HEAD = 0x40a0, SLOT0 = 0x40c0;

function base(mem, m) {
  m.push16(0x9999);
  m.regs.ix = OBJ;
  mem[TICK] = 0x20; mem[STATE] = 0; mem[SELECTOR] = 0x10;
}
const runEntry = () => craft((mem, m) => { base(mem, m); mem[TIMER] = 3; });
const expireEntry = () => craft((mem, m) => {
  base(mem, m); mem[TIMER] = 1;
  mem[HEAD] = 0xc0; mem[SLOT0] = 0x80; // one free queue slot at the floor
});

test("EQUAL (crafted): loc_10c2 == oracle while the timer runs", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, runEntry()), null, "loc_10c2 diverged on the run path");
  const a = runEntry(); oracle(a);
  assert.equal(a.mem8[TICK], 0x21, "positive control: tick counter bumped");
  assert.equal(a.mem8[TIMER], 2, "positive control: timer decremented");
  assert.equal(a.mem8[STATE], 0, "positive control: state untouched while running");
  console.log("  EQUAL: loc_10c2 == oracle (RAM), tick++ + timer 3->2, no advance");
});

test("EQUAL (crafted): loc_10c2 == oracle on timer expiry", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expireEntry()), null, "loc_10c2 diverged on the expire path");
  const a = expireEntry(); oracle(a);
  assert.equal(a.mem8[TIMER], 0, "positive control: timer hit 0");
  assert.equal(a.mem8[STATE], 1, "positive control: state advanced");
  assert.equal(a.mem8[SLOT0], 0x06, "positive control: command channel queued");
  assert.equal(a.mem8[SLOT0 + 1], (0x10 + 0x4b) & 0xff, "positive control: command param = selector + 0x4b");
  console.log("  EQUAL: loc_10c2 == oracle (RAM), expiry -> queue + state advance");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTimer = (m) => { cand(m); m.mem8[TIMER] ^= 0xff; };
  const wrongParam = (m) => { cand(m); m.mem8[SLOT0 + 1] ^= 0xff; };
  assert.ok(ramDiff(oracle, noOp, runEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTimer, runEntry()), "the wrong-timer twin escaped");
  assert.ok(ramDiff(oracle, wrongParam, expireEntry()), "the wrong-param twin escaped");
  console.log("  TEETH: no-op, wrong-timer (run), wrong-param (expire) all caught");
});
