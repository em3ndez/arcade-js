// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1cff (Frogger frog-Y home-row cp-ladder, ROM 0x1CFF-0x1D76). A=(0x8044) is
// compared to six band boundaries and tails to one of 0x1d87/1dd8/1e29/1e7a/1ecb (a matched row) or
// 0x1d77 (below-0x15, inter-band gaps, and the fall-through below all bands). Every tail-jp target
// is a no-op stub; the test asserts which one each frog-Y band dispatches to.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1cff } from "../loc_1cff.js";

const noop = () => {}; // stubbed tail-jump target (jp, so nothing was pushed)

function mk() {
  const routines = new Map([
    [0x1d77, noop], [0x1d87, noop], [0x1dd8, noop],
    [0x1e29, noop], [0x1e7a, noop], [0x1ecb, noop],
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

function dispatch(y) {
  const m = mk();
  w(m, 0x8044, y);
  loc_1cff(m);
  return m;
}

test("loc_1cff: below 0x15 -> loc_1d77 (30 T)", () => {
  const m = dispatch(0x10);
  assert.deepEqual(m.calls, [0x1d77]);
  assert.equal(m.cycles, 30, "ld a,(nn)13 + cp 0x15 7 + jp c taken 10");
});

test("loc_1cff: band boundaries dispatch to their row handlers", () => {
  assert.deepEqual(dispatch(0x1c).calls, [0x1d87], "0x1c == boundary -> jp z");
  assert.deepEqual(dispatch(0x18).calls, [0x1d87], "0x15..0x1b -> jp c");
  assert.deepEqual(dispatch(0x4c).calls, [0x1dd8], "0x4c band");
  assert.deepEqual(dispatch(0x7c).calls, [0x1e29], "0x7c band");
  assert.deepEqual(dispatch(0xac).calls, [0x1e7a], "0xac band");
  assert.deepEqual(dispatch(0xdc).calls, [0x1ecb], "0xdc band");
});

test("loc_1cff: inter-band gap and above-all-bands -> loc_1d77", () => {
  assert.deepEqual(dispatch(0x30).calls, [0x1d77], "gap 0x2e..0x34 -> loc_1d77");
  assert.deepEqual(dispatch(0xff).calls, [0x1d77], "above 0xdc falls through to loc_1d77");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1cff.js
//   find: regs.cp(0x4c);
//   repl: regs.cp(0x51);
//   expect: FAIL  (the 0x4c band boundary shifts up; frog-Y 0x50 misroutes to 0x1dd8, not 0x1d77)
//   verified-anchor: count == 1  (the sole regs.cp(0x4c) in loc_1cff.js)
// Simulated by intercepting exactly the cp 0x4c, which is what the edit produces.
test("loc_1cff: the ladder catches a shifted band boundary", () => {
  assert.deepEqual(dispatch(0x50).calls, [0x1d77], "faithful: frog-Y 0x50 -> loc_1d77");
  const m = mk();
  w(m, 0x8044, 0x50);
  const ocp = m.regs.cp.bind(m.regs);
  m.regs.cp = (v) => ocp(v === 0x4c ? 0x51 : v);
  loc_1cff(m);
  assert.throws(() => assert.deepEqual(m.calls, [0x1d77]), "mutation misroutes 0x50 into the 0x4c band");
});
