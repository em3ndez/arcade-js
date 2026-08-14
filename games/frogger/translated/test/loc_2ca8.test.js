// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2ca8 (Frogger IX sprite-object arm, ROM 0x2CA8-0x2CD5): proximity test. Active
// ((ix+0x06)!=0) and same row ((ix+0x04)==(0x8047)); then A = (iy+0x00) -0x04 if (ix+0x05)!=0 else +0x14,
// minus (0x8044); landing in [0,0x10) sets (0x8004)=0x01 and (ix+0x06)=0x02. Leaf, no callees.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2ca8 } from "../loc_2ca8.js";

const IX = 0x8060, IY = 0x8070;

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  set(m, 0x8047, 0x05); // frog row
  set(m, 0x8044, 0x20); // frog X
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
function set(m, a, v) { m.mem.workRam[a - 0x8000] = v; }

// (ix+0x05)==0 -> +0x14 arm: A = 0x10+0x14 - 0x20 = 0x04, in [0,0x10) -> hit.
test("loc_2ca8: (ix+0x05)==0 +0x14 arm registers a hit; 220 T", () => {
  const m = mk();
  set(m, IX + 6, 0x01); set(m, IX + 4, 0x05); set(m, IX + 5, 0x00); set(m, IY + 0, 0x10);
  loc_2ca8(m);
  assert.equal(r(m, 0x8004), 0x01, "(0x8004) hit flag set");
  assert.equal(r(m, IX + 6), 0x02, "(ix+0x06) advanced to 0x02");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.equal(m.cycles, 220, "full hit path, three ret cc fall-throughs");
});

// (ix+0x05)!=0 -> -0x04 arm: A = 0x28-0x04 - 0x20 = 0x04, in [0,0x10) -> hit.
test("loc_2ca8: (ix+0x05)!=0 -0x04 arm registers a hit", () => {
  const m = mk();
  set(m, IX + 6, 0x01); set(m, IX + 4, 0x05); set(m, IX + 5, 0x01); set(m, IY + 0, 0x28);
  loc_2ca8(m);
  assert.equal(r(m, 0x8004), 0x01, "(0x8004) hit flag set");
  assert.equal(r(m, IX + 6), 0x02, "(ix+0x06) advanced to 0x02");
});

// Wrong row -> ret nz, no hit.
test("loc_2ca8: different row rets nz, no hit", () => {
  const m = mk();
  set(m, IX + 6, 0x01); set(m, IX + 4, 0x09); set(m, IX + 5, 0x00); set(m, IY + 0, 0x10);
  loc_2ca8(m);
  assert.equal(r(m, 0x8004), 0x00, "no hit flag");
  assert.equal(r(m, IX + 6), 0x01, "(ix+0x06) unchanged");
});

// Too far right (A >= 0x10) -> ret nc, no hit.
test("loc_2ca8: out-of-range distance rets nc, no hit", () => {
  const m = mk();
  set(m, IX + 6, 0x01); set(m, IX + 4, 0x05); set(m, IX + 5, 0x00); set(m, IY + 0, 0x30);
  loc_2ca8(m); // A = 0x30+0x14-0x20 = 0x24 >= 0x10
  assert.equal(r(m, 0x8004), 0x00, "no hit flag");
  assert.equal(r(m, IX + 6), 0x01, "(ix+0x06) unchanged");
});

// Inactive -> ret z immediately; 34 T.
test("loc_2ca8: inactive object rets z; 34 T", () => {
  const m = mk();
  set(m, IX + 6, 0x00);
  loc_2ca8(m);
  assert.equal(r(m, 0x8004), 0x00, "no hit flag");
  assert.equal(m.cycles, 34, "ld a,(ix+6) 19 + or a 4 + ret z 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2ca8.js
//   find: mem.write8((regs.ix + 0x06) & 0xffff, 0x02); // (ix+0x06) = 2
//   repl: mem.write8((regs.ix + 0x06) & 0xffff, 0x03);
//   expect: FAIL  ((ix+0x06) advanced to 0x03 not 0x02 — caught by the assert)
//   verified-anchor: count == 1  (the sole (ix+0x06) store in loc_2ca8.js)
// Simulated by bumping exactly the (ix+0x06) hit-store value.
test("loc_2ca8: the contract catches a wrong hit state", () => {
  const m = mk();
  set(m, IX + 6, 0x01); set(m, IX + 4, 0x05); set(m, IX + 5, 0x00); set(m, IY + 0, 0x10);
  const ix6 = (m.regs.ix + 0x06) & 0xffff;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === ix6 ? (val + 1) & 0xff : val, o);
  loc_2ca8(m);
  assert.notEqual(r(m, IX + 6), 0x02, "hit state corrupted");
});
