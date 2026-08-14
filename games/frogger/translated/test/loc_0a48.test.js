// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0a48 (Frogger lives/level row render, ROM 0x0A48-0x0A5E): draw B copies of tile
// 0x4C down the column at 0xA87E stepping +0x20, where B = min((0x83B7), 0x0F).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0a48 } from "../loc_0a48.js";

function mk(lives) {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x3b7] = lives;
  return m;
}
const v = (m, i) => m.mem.videoRam[i]; // 0xa87e & 0x3ff = 0x07e

function check5(m) {
  for (let k = 0; k < 5; k++) assert.equal(v(m, 0x07e + k * 0x20), 0x4c, `cell ${k} tile 0x4c`);
  assert.equal(v(m, 0x07e + 5 * 0x20), 0x00, "6th cell not written");
}

test("loc_0a48: draws 5 tiles for (0x83B7)==5; 223 T", () => {
  const m = mk(0x05);
  loc_0a48(m);
  check5(m);
  assert.equal(m.cycles, 223, "setup 52 + ld b,a/ld c 11 + 5-tile loop 150 + ret 10");
});

test("loc_0a48: clamps the count to 0x0F", () => {
  const m = mk(0x20);
  loc_0a48(m);
  assert.equal(v(m, 0x07e + 14 * 0x20), 0x4c, "15th (clamped) cell drawn");
  assert.equal(v(m, 0x07e + 15 * 0x20), 0x00, "16th cell not drawn");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0a48.js
//   find: regs.c = 0x4c;
//   repl: regs.c = 0x4d;
//   expect: FAIL  (draws tile 0x4d instead of 0x4c — caught by check5)
//   verified-anchor: count == 1  (the sole ld c,0x4c in loc_0a48.js)
// Simulated by intercepting exactly the 0x4c tile store, which is what the edit produces.
test("loc_0a48: the contract catches a wrong row tile", () => {
  const m = mk(0x05);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x4c ? 0x4d : val, o);
  loc_0a48(m);
  assert.throws(() => check5(m));
});
