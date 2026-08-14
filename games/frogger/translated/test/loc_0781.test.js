// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0781 (Frogger intro VRAM strip clear, ROM 0x0781-0x0793): fill a 0x16-wide,
// 0x20-tall block from 0xA808 with tile 0x10, skipping 0x0A columns between rows (row pitch 0x20).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0781 } from "../loc_0781.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const v = (m, i) => m.mem.videoRam[i]; // 0xa808 & 0x3ff = 0x008

function check(m) {
  assert.equal(v(m, 0x008), 0x10, "row 0, first cell");
  assert.equal(v(m, 0x01d), 0x10, "row 0, last (0x16th) cell");
  assert.equal(v(m, 0x01e), 0x00, "the skipped column is not written");
  assert.equal(v(m, 0x028), 0x10, "row 1 starts one 0x20 pitch on");
  assert.equal(v(m, 0x008 + 31 * 0x20), 0x10, "row 31 (last), first cell");
}

test("loc_0781: fills a 0x16x0x20 tile block from 0xA808 with tile 0x10", () => {
  const m = mk();
  loc_0781(m);
  check(m);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0781.js
//   find: regs.de = 0x2010;
//   repl: regs.de = 0x2011;   // E = 0x11, the fill tile
//   expect: FAIL  (fills tile 0x11 instead of 0x10 — caught by check)
//   verified-anchor: count == 1  (the sole ld de in loc_0781.js; E is the fill tile)
// Simulated by intercepting the tile store (E=0x10 -> 0x11), which is what that edit produces.
test("loc_0781: the contract catches a wrong fill tile", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x10 ? 0x11 : val, o);
  loc_0781(m);
  assert.throws(() => check(m));
});
