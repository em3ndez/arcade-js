// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0d11 (Frogger intro/mode state machine, ROM 0x0D11-0x0D4B). Gated by the
// (0x83D8) frame timer; a cp-ladder on the mode byte (0x83D6) dispatches to 0x0BB3 (mode 3), 0x0D4C
// (in-play, when (0x83E1)!=0), 0x0C6D (mode 4 marquee -- dead in-play), or 0x2D88 (mode 2); mode 5
// falls through to the reset arm (reseed timer, clear (0x83D7)/(0x8015), rst 0x28, jp 0x0C17). All
// callees stubbed: rst 0x28 SP-balanced; every jp target a no-op.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0d11 } from "../loc_0d11.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // stubbed rst 0x28 returns
const noop = () => {}; // stubbed tail-jump target

function mk() {
  const routines = new Map([
    [0x0028, bal],
    [0x0bb3, noop], [0x0d4c, noop], [0x0c6d, noop], [0x2d88, noop], [0x0c17, noop],
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

test("loc_0d11: (0x83d8) timer running -> ret nz, no dispatch, 28 T", () => {
  const m = mk();
  w(m, 0x83d8, 0x07);
  loc_0d11(m);
  assert.deepEqual(m.calls, [], "no dispatch while the timer runs");
  assert.equal(m.cycles, 28, "ld a,(nn)13 + or a 4 + ret nz taken 11");
});

test("loc_0d11: mode 3 -> jp 0x0bb3", () => {
  const m = mk();
  w(m, 0x83d8, 0x00); w(m, 0x83d6, 0x03);
  loc_0d11(m);
  assert.deepEqual(m.calls, [0x0bb3]);
});

test("loc_0d11: in-play flag set -> jp 0x0d4c", () => {
  const m = mk();
  w(m, 0x83d8, 0x00); w(m, 0x83d6, 0x00); w(m, 0x83e1, 0x01);
  loc_0d11(m);
  assert.deepEqual(m.calls, [0x0d4c]);
});

test("loc_0d11: mode 4 -> jp 0x0c6d (attract marquee)", () => {
  const m = mk();
  w(m, 0x83d8, 0x00); w(m, 0x83d6, 0x04); w(m, 0x83e1, 0x00);
  loc_0d11(m);
  assert.deepEqual(m.calls, [0x0c6d]);
});

test("loc_0d11: mode 2 -> jp 0x2d88", () => {
  const m = mk();
  w(m, 0x83d8, 0x00); w(m, 0x83d6, 0x02); w(m, 0x83e1, 0x00);
  loc_0d11(m);
  assert.deepEqual(m.calls, [0x2d88]);
});

test("loc_0d11: unmatched mode -> ret nz, no dispatch, no writes", () => {
  const m = mk();
  w(m, 0x83d8, 0x00); w(m, 0x83d6, 0x00); w(m, 0x83e1, 0x00);
  w(m, 0x83d7, 0xaa);
  loc_0d11(m);
  assert.deepEqual(m.calls, []);
  assert.equal(r(m, 0x83d7), 0xaa, "reset arm not entered");
});

function checkMode5(m) {
  assert.equal(r(m, 0x83d8), 0x30, "(0x83d8) reseeded to 0x30");
  assert.equal(r(m, 0x83d7), 0x00, "(0x83d7) cleared");
  assert.equal(r(m, 0x8015), 0x00, "(0x8015) cleared");
}

test("loc_0d11: mode 5 -> reset arm (reseed/clear, rst 0x28, jp 0x0c17)", () => {
  const m = mk();
  w(m, 0x83d8, 0x00); w(m, 0x83d6, 0x05); w(m, 0x83e1, 0x00);
  w(m, 0x83d7, 0xff); w(m, 0x8015, 0xff);
  loc_0d11(m);
  checkMode5(m);
  assert.deepEqual(m.calls, [0x0028, 0x0c17], "blit then jp");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0d11.js
//   find: mem.write8(regs.hl, 0x30);
//   repl: mem.write8(regs.hl, 0x31);
//   expect: FAIL  (the mode-5 reset reseeds the (0x83d8) timer to the wrong value)
//   verified-anchor: count == 1  (the sole `mem.write8(regs.hl, 0x30);` in loc_0d11.js)
// Simulated by intercepting exactly the 0x30 store to 0x83d8, which is what the edit produces.
test("loc_0d11: the contract catches a wrong reseed value", () => {
  const m = mk();
  w(m, 0x83d8, 0x00); w(m, 0x83d6, 0x05); w(m, 0x83e1, 0x00);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === 0x83d8 && val === 0x30 ? 0x31 : val, o);
  loc_0d11(m);
  assert.throws(() => checkMode5(m));
});
