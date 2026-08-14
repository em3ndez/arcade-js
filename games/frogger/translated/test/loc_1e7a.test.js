// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1e7a (ROM 0x1E7A-0x1ECA, home-row handler row-4) and its file-sibling loc_1ecb
// (ROM 0x1ECB-0x1F1B, row-5), the two dispatch targets loc_1cff jumps into. Callees stubbed: loc_2673,
// loc_1f1c, loc_27cb are SP-balanced CALL targets; loc_1acb is the reject tail-jump (no SP move).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1e7a, loc_1ecb } from "../loc_1e7a.js";

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

// -- loc_1e7a (row-4) ---------------------------------------------------------

function check4(m) {
  assert.equal(r(m, 0x8261), 0x01, "P1 done flag (0x8261) set");
  assert.equal(r(m, 0x825c), 0x01, "P1 home count (0x825c) incremented");
}

test("loc_1e7a: P1 first entry awards (key 4), scores, marks the flag", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 4);
  loc_1e7a(m);
  check4(m);
  assert.deepEqual(m.calls, [0x2673, 0x1f1c], "award then goal-scoring, no 27cb (0x8134==0)");
});

test("loc_1e7a: (0x8047)>=0x2a rejects to loc_1acb; 76 T", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8047, 0x2a);
  loc_1e7a(m);
  assert.deepEqual(m.calls, [0x1acb], "tail-jump to input scan");
  assert.equal(m.cycles, 76, "9-instruction reject path");
});

test("loc_1e7a: P2, no award, (0x8134)!=0 runs 27cb", () => {
  const m = mk();
  w(m, 0x83fd, 2); w(m, 0x8121, 9); w(m, 0x8134, 1);
  loc_1e7a(m);
  assert.equal(r(m, 0x8266), 0x01, "P2 done flag (0x8266) set");
  assert.equal(r(m, 0x825d), 0x01, "P2 home count (0x825d) incremented");
  assert.equal(r(m, 0x8134), 0x00, "(0x8134) cleared after 27cb");
  assert.deepEqual(m.calls, [0x1f1c, 0x27cb], "goal-scoring then 27cb, no award");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1e7a.js
//   find: mem.write8(0x8261, regs.a);
//   repl: mem.write8(0x8262, regs.a);   // row-5's flag
//   expect: FAIL  ((0x8261) stays 0 -- caught by check4)
//   verified-anchor: count == 1  (the sole write to 0x8261 in loc_1e7a)
// Simulated by redirecting exactly the 0x8261 store, which is what the edit produces.
test("loc_1e7a: the contract catches a wrong P1 done-flag address", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 4);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x8261 ? 0x8262 : a, v, o);
  loc_1e7a(m);
  assert.throws(() => check4(m));
});

// -- loc_1ecb (row-5) ---------------------------------------------------------

function check5(m) {
  assert.equal(r(m, 0x8262), 0x01, "P1 done flag (0x8262) set");
  assert.equal(r(m, 0x825c), 0x01, "P1 home count (0x825c) incremented");
}

test("loc_1ecb: P1 first entry awards (key 5), scores, marks the flag", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 5);
  loc_1ecb(m);
  check5(m);
  assert.deepEqual(m.calls, [0x2673, 0x1f1c], "award then goal-scoring");
});

test("loc_1ecb: (0x8047)>=0x2a rejects to loc_1acb; 76 T", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8047, 0x2a);
  loc_1ecb(m);
  assert.deepEqual(m.calls, [0x1acb], "tail-jump to input scan");
  assert.equal(m.cycles, 76, "9-instruction reject path");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1e7a.js
//   find: mem.write8(0x8262, regs.a);
//   repl: mem.write8(0x8261, regs.a);   // row-4's flag
//   expect: FAIL  ((0x8262) stays 0 -- caught by check5)
//   verified-anchor: count == 1  (the sole write to 0x8262 in loc_1ecb)
// Simulated by redirecting exactly the 0x8262 store, which is what the edit produces.
test("loc_1ecb: the contract catches a wrong P1 done-flag address", () => {
  const m = mk();
  w(m, 0x83fd, 1); w(m, 0x8121, 5);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x8262 ? 0x8261 : a, v, o);
  loc_1ecb(m);
  assert.throws(() => check5(m));
});
