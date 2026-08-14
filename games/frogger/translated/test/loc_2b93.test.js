// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2b93 (Frogger IX sprite-object arm, ROM 0x2B93-0x2BAA). IX = object struct at
// 0x8490, IY = sprite slot at 0x8058 (the caller's values at 0x29AD/0x29B1). When (ix+0x06)!=0 it
// reads table byte 0x80(ix+0x0b), stores table-(ix+0x02) to (iy+0x00) and (ix+0x04) to (iy+0x03).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2b93 } from "../loc_2b93.js";

const IX = 0x8490, IY = 0x8058;
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  w(m, IX + 0x06, 0x03);  // active
  w(m, IX + 0x0b, 0x40);  // table index -> HL = 0x8040
  w(m, IX + 0x02, 0x10);
  w(m, IX + 0x04, 0x07);
  w(m, 0x8040, 0x50);     // table[0x8040]
  return m;
}

function check(m) {
  assert.equal(r(m, 0x8058), 0x40, "(iy+0x00) = table - (ix+0x02) = 0x50-0x10");
  assert.equal(r(m, 0x805b), 0x07, "(iy+0x03) = (ix+0x04)");
}

test("loc_2b93: writes the two IY fields from the table and struct", () => {
  const m = mk();
  loc_2b93(m);
  check(m);
});

test("loc_2b93: (ix+0x06)==0 rets immediately; 34 T; no IY write", () => {
  const m = mk();
  w(m, IX + 0x06, 0x00);
  loc_2b93(m);
  assert.equal(m.cycles, 34, "ld(ix)19 + or 4 + ret z taken 11");
  assert.equal(r(m, 0x8058), 0x00, "(iy+0x00) untouched");
  assert.equal(r(m, 0x805b), 0x00, "(iy+0x03) untouched");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2b93.js
//   find: mem.write8((regs.iy + 0x03) & 0xffff, regs.a);
//   repl: mem.write8((regs.iy + 0x04) & 0xffff, regs.a);   // wrong IY store offset
//   expect: FAIL  ((ix+0x04) lands at 0x805c, so (0x805b) stays 0 -> check throws)
//   verified-anchor: count == 1  (the sole (regs.iy + 0x03) in loc_2b93.js)
test("loc_2b93: a wrong IY store offset misses the (iy+0x03) field", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a === 0x805b ? 0x805c : a, val, o);
  loc_2b93(m);
  assert.throws(() => check(m));
});
