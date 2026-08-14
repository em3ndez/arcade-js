// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0a16 (Frogger time-bar render, ROM 0x0A16-0x0A47): select a countdown byte, draw
// B copies of tile 0x4D up from 0xABBE stepping -0x20, then cap with tile 0x10. Early-rets on
// (0x83E4)==0xFF.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0a16 } from "../loc_0a16.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const v = (m, i) => m.mem.videoRam[i]; // 0xabbe & 0x3ff = 0x3be

function check3(m) {
  assert.equal(v(m, 0x3be), 0x4d, "bar tile 0");
  assert.equal(v(m, 0x39e), 0x4d, "bar tile 1 (-0x20)");
  assert.equal(v(m, 0x37e), 0x4d, "bar tile 2 (-0x40)");
  assert.equal(v(m, 0x35e), 0x10, "cap tile 0x10");
}

test("loc_0a16: draws a 3-cell bar for attract state ((0x83FE)==0, (0x83E4)==3); 225 T", () => {
  const m = mk();
  m.mem.workRam[0x3e4] = 0x03; // (0x83e4) attract countdown, also the B source
  loc_0a16(m);
  check3(m);
  assert.equal(m.cycles, 225, "setup 68 + block 49 + 3-tile loop 88 + cap+ret 20");
});

test("loc_0a16: (0x83E4)==0xFF rets before drawing; 28 T", () => {
  const m = mk();
  m.mem.workRam[0x3e4] = 0xff;
  loc_0a16(m);
  assert.equal(v(m, 0x3be), 0x00, "nothing drawn");
  assert.equal(m.cycles, 28, "ld a,(nn)13 + inc a 4 + ret z 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0a16.js
//   find: regs.a = 0x4d;
//   repl: regs.a = 0x4e;
//   expect: FAIL  (bar drawn with tile 0x4e — caught by check3)
//   verified-anchor: count == 1  (the sole ld a,0x4d in loc_0a16.js)
// Simulated by intercepting exactly the 0x4d bar store, which is what the edit produces.
test("loc_0a16: the contract catches a wrong bar tile", () => {
  const m = mk();
  m.mem.workRam[0x3e4] = 0x03;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x4d ? 0x4e : val, o);
  loc_0a16(m);
  assert.throws(() => check3(m));
});
