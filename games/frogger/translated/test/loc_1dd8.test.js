// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1dd8 (ROM 0x1DD8-0x1E28, home-row handler row-2) and its file-sibling loc_1e29
// (ROM 0x1E29-0x1E79, row-3), the two dispatch targets loc_1cff jumps into. Callees stubbed: loc_2673
// (award), loc_1f1c (goal scoring), loc_27cb are SP-balanced CALL targets; loc_1acb is the reject
// tail-jump (no push, so no SP move).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1dd8, loc_1e29 } from "../loc_1dd8.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const noop = () => {};

function mk() {
  const routines = new Map([
    [0x2673, bal], [0x1f1c, bal], [0x27cb, bal], [0x1acb, noop],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

// -- loc_1dd8 (row-2) ---------------------------------------------------------

function check1(m) {
  assert.equal(r(m, 0x825f), 0x01, "P1 done flag (0x825f) set");
  assert.equal(r(m, 0x825c), 0x01, "P1 home count (0x825c) incremented");
}

test("loc_1dd8: P1 first entry awards (key 2), scores, marks the flag", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 2); // player 1, award key matches (0x8121)==2
  loc_1dd8(m);
  check1(m);
  assert.deepEqual(m.calls, [0x2673, 0x1f1c], "award then goal-scoring, no 27cb (0x8134==0)");
});

test("loc_1dd8: (0x8047)>=0x2a rejects to loc_1acb; 76 T", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8047, 0x2a);
  loc_1dd8(m);
  assert.deepEqual(m.calls, [0x1acb], "tail-jump to input scan");
  assert.equal(r(m, 0x825f), 0x00, "done flag untouched");
  assert.equal(m.cycles, 76, "ld/dec/jr-nt/ld/and/ret-nt/ld/cp/jp = 13+4+7+13+4+5+13+7+10");
});

test("loc_1dd8: P2, no award (key mismatch), (0x8134)!=0 runs 27cb", () => {
  const m = mk();
  w(m, 0x83fd, 2); w(m, 0x8121, 5); w(m, 0x8134, 1);
  loc_1dd8(m);
  assert.equal(r(m, 0x8264), 0x01, "P2 done flag (0x8264) set");
  assert.equal(r(m, 0x825d), 0x01, "P2 home count (0x825d) incremented");
  assert.equal(r(m, 0x8134), 0x00, "(0x8134) cleared after 27cb");
  assert.deepEqual(m.calls, [0x1f1c, 0x27cb], "goal-scoring then 27cb, no award");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1dd8.js
//   find: mem.write8(0x825f, regs.a);
//   repl: mem.write8(0x8260, regs.a);   // wrong done-flag address (row-3's flag)
//   expect: FAIL  ((0x825f) stays 0 -- caught by check1)
//   verified-anchor: count == 1  (the sole write to 0x825f in loc_1dd8.js)
// Simulated by redirecting exactly the 0x825f store, which is what the edit produces.
test("loc_1dd8: the contract catches a wrong P1 done-flag address", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 2);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x825f ? 0x8260 : a, v, o);
  loc_1dd8(m);
  assert.throws(() => check1(m));
});

// -- loc_1e29 (row-3) ---------------------------------------------------------

function check2(m) {
  assert.equal(r(m, 0x8260), 0x01, "P1 done flag (0x8260) set");
  assert.equal(r(m, 0x825c), 0x01, "P1 home count (0x825c) incremented");
}

test("loc_1e29: P1 first entry awards (key 3), scores, marks the flag", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 3); // award key matches (0x8121)==3
  loc_1e29(m);
  check2(m);
  assert.deepEqual(m.calls, [0x2673, 0x1f1c], "award then goal-scoring");
});

test("loc_1e29: (0x8047)>=0x2a rejects to loc_1acb; 76 T", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8047, 0x2a);
  loc_1e29(m);
  assert.deepEqual(m.calls, [0x1acb], "tail-jump to input scan");
  assert.equal(m.cycles, 76, "same 9-instruction reject path as row-2");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1dd8.js
//   find: mem.write8(0x8260, regs.a);
//   repl: mem.write8(0x825f, regs.a);   // row-2's flag -- marks the wrong player state
//   expect: FAIL  ((0x8260) stays 0 -- caught by check2)
//   verified-anchor: count == 1  (the sole write to 0x8260 in loc_1e29)
// Simulated by redirecting exactly the 0x8260 store, which is what the edit produces.
test("loc_1e29: the contract catches a wrong P1 done-flag address", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 3);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x8260 ? 0x825f : a, v, o);
  loc_1e29(m);
  assert.throws(() => check2(m));
});
