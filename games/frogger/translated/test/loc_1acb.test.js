// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1acb (Frogger frog input scan, ROM 0x1ACB-0x1B8A). Gated by (0x826C); a hop
// timer (0x8268) decrements then rets via a stubbed 0x23eb; when (0x8004)==0 it reads the joystick
// ports (idle 0xE000=0xFF/0xE002=0xFC/0xE004=0xF1), clears the direction/ride flags 0x824C-0x824F +
// 0x8250-0x8253, and cp/bit-dispatches by lane state (0x8248-0x824B). All callees stubbed: 0x23eb
// SP-balanced; every ride/move tail-jump target a no-op.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1acb } from "../loc_1acb.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // stubbed CALL returns
const noop = () => {}; // stubbed tail-jump target

function mk() {
  const routines = new Map([
    [0x23eb, bal],
    [0x1bba, noop], [0x1b8b, noop], [0x1c0d, noop], [0x1be4, noop],
    [0x1c41, noop], [0x1c76, noop], [0x1ca0, noop], [0x1cd5, noop],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_1acb: (0x826c) busy -> ret nz, no dispatch, 28 T", () => {
  const m = mk();
  w(m, 0x826c, 0x01);
  loc_1acb(m);
  assert.deepEqual(m.calls, []);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + and a 4 + ret nz taken 11");
});

test("loc_1acb: hop timer (0x8268) decrements then rets via 0x23eb", () => {
  const m = mk();
  w(m, 0x826c, 0x00); w(m, 0x8268, 0x05);
  loc_1acb(m);
  assert.equal(r(m, 0x8268), 0x04, "(0x8268) decremented");
  assert.deepEqual(m.calls, [0x23eb]);
});

test("loc_1acb: (0x8004) set -> ret nz before any flag clear", () => {
  const m = mk();
  w(m, 0x826c, 0x00); w(m, 0x8268, 0x00); w(m, 0x8004, 0x01);
  w(m, 0x824c, 0xff);
  loc_1acb(m);
  assert.deepEqual(m.calls, []);
  assert.equal(r(m, 0x824c), 0xff, "flag-clear block not entered");
});

function checkCleared(m) {
  for (const a of [0x824c, 0x824d, 0x824e, 0x824f, 0x8250, 0x8251, 0x8252, 0x8253]) {
    assert.equal(r(m, a), 0x00, `(0x${a.toString(16)}) cleared`);
  }
}

function mkClearAll() {
  const m = mk();
  for (const a of [0x826c, 0x8268, 0x8004, 0x8248, 0x8249, 0x824a, 0x824b]) w(m, a, 0x00);
  for (const a of [0x824c, 0x824d, 0x824e, 0x824f, 0x8250, 0x8251, 0x8252, 0x8253]) w(m, a, 0xff);
  return m;
}

test("loc_1acb: idle inputs + no lane state -> clears all direction/ride flags, no dispatch", () => {
  const m = mkClearAll();
  loc_1acb(m);
  checkCleared(m);
  assert.deepEqual(m.calls, []);
});

test("loc_1acb: lane state (0x8248) set -> dispatch to 0x1bba", () => {
  const m = mk();
  for (const a of [0x826c, 0x8268, 0x8004]) w(m, a, 0x00);
  w(m, 0x8248, 0x01);
  loc_1acb(m);
  assert.deepEqual(m.calls, [0x1bba]);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1acb.js
//   find: mem.write8(0x824c, regs.a);
//   repl: mem.write8(0x844c, regs.a);
//   expect: FAIL  (the first ride flag 0x824c is left uncleared, staying 0xff)
//   verified-anchor: count == 1  (the sole mem.write8(0x824c, regs.a) in loc_1acb.js)
// Simulated by redirecting exactly the 0x824c store, which is what the edit produces.
test("loc_1acb: the clear-all contract catches a dropped flag write", () => {
  const m = mkClearAll();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a === 0x824c ? 0x844c : a, val, o);
  loc_1acb(m);
  assert.throws(() => checkCleared(m));
});
