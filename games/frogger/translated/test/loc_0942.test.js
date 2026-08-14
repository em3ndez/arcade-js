// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0942 (Frogger loc_0425 render core, ROM 0x0942-0x09DA). Runs the game-timer
// countdown on 0x83e5/0x83e6 (gated by (0x83cd)), renders frog (call 0x1952) + home-marker (call
// 0x19e2) + anim (call 0x223d/0x0faf), delegating into carved-out loc_09aa. All callees stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0942 } from "../loc_0942.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = [0x1952, 0x19e2, 0x09db, 0x223d, 0x0faf, 0x09aa];

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map(STUBS.map((a) => [a, bal])));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, val) => { m.mem.workRam[a - 0x8000] = val; };

// Path A: (0x83cd)=0, timer at 0x83e5 hits 0 -> (0x83cf)=1; then (0x825a)=0 delegates to loc_09aa.
function setA(m) {
  w(m, 0x83cd, 0x00); w(m, 0x83fe, 0x01); w(m, 0x83fd, 0x01);
  w(m, 0x83e5, 0x01); w(m, 0x825a, 0x00); w(m, 0x826c, 0x01);
}
function checkA(m) {
  assert.equal(r(m, 0x83ce), 0x00, "(0x83ce) cleared");
  assert.equal(r(m, 0x83cf), 0x01, "(0x83cf) = 1 -- timer elapsed");
  assert.equal(r(m, 0x83e5), 0x00, "(0x83e5) decremented to 0");
  assert.equal(r(m, 0x83b5), 0x00, "(0x83b5) = (0x826c) ^ 1 = 0");
}

test("loc_0942 path A: timer elapses, renders, delegates to loc_09aa", () => {
  const m = mk();
  setA(m);
  loc_0942(m);
  checkA(m);
  assert.deepEqual(m.calls, [0x1952, 0x19e2, 0x09db, 0x09aa], "frog, marker, anim-row, delegate");
  assert.equal(m.regs.sp, 0x8800, "calls balanced + delegate popped the caller frame");
});

// Path B: phase>1 (0x83fd=2) -> timer cell 0x83e6, no elapse; (0x83fd-1)!=0 routes via loc_09d2.
test("loc_0942 path B: phase-2 timer via 0x83e6 + the loc_09d2 re-entry into loc_099a", () => {
  const m = mk();
  w(m, 0x83cd, 0x00); w(m, 0x83fe, 0x01); w(m, 0x83fd, 0x02);
  w(m, 0x83e6, 0x05); w(m, 0x825a, 0x00); w(m, 0x826c, 0x00);
  loc_0942(m);
  assert.equal(r(m, 0x83ce), 0x00, "(0x83ce) cleared");
  assert.equal(r(m, 0x83cf), 0x00, "(0x83cf) not set -- timer did not elapse");
  assert.equal(r(m, 0x83e6), 0x04, "(0x83e6) decremented to 4");
  assert.equal(r(m, 0x83b5), 0x01, "(0x83b5) = (0x826c) ^ 1 = 1");
  assert.deepEqual(m.calls, [0x1952, 0x19e2, 0x09db, 0x09aa], "same render set via loc_09d2");
  assert.equal(m.regs.sp, 0x8800, "balanced");
});

// Path C: (0x83fe)=0 -> the loc_09ca arm, (0x83cd)=0 so `ret z` returns with no render calls.
test("loc_0942 path C: (0x83fe)=0 takes the loc_09ca ret-z exit", () => {
  const m = mk();
  w(m, 0x83cd, 0x00); w(m, 0x83fe, 0x00);
  loc_0942(m);
  assert.equal(r(m, 0x83ce), 0x00, "(0x83ce) cleared");
  assert.equal(r(m, 0x83cf), 0x00, "(0x83cf) cleared");
  assert.deepEqual(m.calls, [], "no render calls on this arm");
  assert.equal(m.regs.sp, 0x8800, "ret z popped the caller frame");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0942.js
//   find: regs.a = 0x01;\n    m.step(0x096f, 7);
//   repl: regs.a = 0x02;   // stores 2 to (0x83cf) instead of the timer-elapsed flag 1
//   expect: FAIL  ((0x83cf) != 1 -- caught by checkA)
//   verified-anchor: the value-1 store to (0x83cf) is the timer-elapsed write at 0x096f
// Simulated by rewriting that store (0x83cf <- 1) to 2, which is what the edit produces.
test("loc_0942: the contract catches a wrong timer-elapsed flag", () => {
  const m = mk();
  setA(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === 0x83cf && val === 0x01 ? 0x02 : val, o);
  loc_0942(m);
  assert.throws(() => checkA(m));
});
