// SPDX-License-Identifier: GPL-3.0-only
// loc_064b: clear 0x800C-0x8037, copy it into OBJRAM 0xB00C, clear 0x8100-0x8162.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_064b } from "../loc_064b.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
const o = (m, a) => m.mem.objRam[a - 0xb000];

test("loc_064b: clears the three demo regions; 3,966 T", () => {
  const m = mk();
  m.mem.workRam[0x00c] = 0xaa; m.mem.workRam[0x037] = 0xbb;
  m.mem.workRam[0x100] = 0xcc; m.mem.workRam[0x162] = 0xdd;
  m.mem.objRam[0x00c] = 0xee;
  loc_064b(m);
  assert.equal(w(m, 0x800c), 0x00, "0x800C cleared");
  assert.equal(w(m, 0x8037), 0x00, "0x8037 cleared (end of first block)");
  assert.equal(o(m, 0xb00c), 0x00, "OBJRAM 0xB00C got the cleared block");
  assert.equal(w(m, 0x8100), 0x00, "0x8100 cleared");
  assert.equal(w(m, 0x8162), 0x00, "0x8162 cleared (end of third block)");
  assert.equal(m.cycles, 3966, "T total (three ldir blocks)");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_064b.js
//   find: m.step(0x0655, 7); // ld (hl),b -- B=0x00 seeds the propagating ldir fill
//   repl: m.step(0x0655, 6);
//   expect: FAIL (the seed store is undercharged; memory identical, only the cycle total moves)
//   verified-anchor: count == 1
test("loc_064b: the cycle total catches a mistimed seed store", () => {
  const m = mk();
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0655 && t === 7 ? 6 : t);
  loc_064b(m);
  assert.equal(w(m, 0x800c), 0x00, "memory unchanged by the timing mutation");
  assert.equal(m.cycles, 3965, "1-T undercharge shows");
});
