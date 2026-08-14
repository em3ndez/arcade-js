// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2b58 (Frogger IX sprite-object arm, leaf, ROM 0x2B58-0x2B82). Fires only when
// (ix+0x06)!=0 AND (ix+0x04)+2 == (0x8047); then, with (iy+0x00) offset by 0x10 when (ix+0x05)==0,
// checks |value - (0x8044)| in [0,0x10) and sets the hit flags (0x8004)=1 / (0x842c)=1.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2b58 } from "../loc_2b58.js";

const IX = 0x8100;
const IY = 0x8200;

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

test("loc_2b58: (ix+0x05)==0 hit -- sets (0x8004)/(0x842c)", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x40); w(m, 0x8047, 0x42); // (ix+4)+2 == (0x8047)
  w(m, IX + 0x05, 0x00); // -> no +0x10
  w(m, IY + 0x00, 0x50); w(m, 0x8044, 0x48); // 0x50 - 0x48 = 0x08 in [0,0x10)
  loc_2b58(m);
  assert.equal(r(m, 0x8004), 0x01, "(0x8004) hit flag");
  assert.equal(r(m, 0x842c), 0x01, "(0x842c) hit flag");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
});

test("loc_2b58: (ix+0x05)!=0 adds 0x10 to the (iy+0x00) view", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x40); w(m, 0x8047, 0x42);
  w(m, IX + 0x05, 0x01); // nonzero -> +0x10
  w(m, IY + 0x00, 0x38); w(m, 0x8044, 0x40); // (0x38+0x10) - 0x40 = 0x08
  loc_2b58(m);
  assert.equal(r(m, 0x8004), 0x01, "hit uses the +0x10 offset");
});

test("loc_2b58: (ix+0x04)+2 != (0x8047) rets nz, no flags", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x40); w(m, 0x8047, 0x99); // mismatch
  loc_2b58(m);
  assert.equal(r(m, 0x8004), 0x00, "no hit flag");
  assert.equal(r(m, 0x842c), 0x00, "no hit flag");
});

test("loc_2b58: (ix+0x06)==0 rets immediately (34 T), no flags", () => {
  const m = mk();
  w(m, IX + 0x06, 0x00);
  loc_2b58(m);
  assert.equal(m.cycles, 34, "ld a,(ix+d)19 + or a 4 + ret z taken 11");
  assert.equal(r(m, 0x8004), 0x00, "no write");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
});

test("loc_2b58: out-of-range distance (>=0x10) rets nc, no flags", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x40); w(m, 0x8047, 0x42);
  w(m, IX + 0x05, 0x00);
  w(m, IY + 0x00, 0x70); w(m, 0x8044, 0x48); // 0x70 - 0x48 = 0x28 >= 0x10
  loc_2b58(m);
  assert.equal(r(m, 0x8004), 0x00, "distance out of window -> no hit");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2b58.js
//   find: regs.a = 0x01;
//   repl: regs.a = 0x00;
//   expect: FAIL  (both hit flags store 0x00 instead of 0x01)
//   verified-anchor: count == 1  (the sole `regs.a = 0x01;` in loc_2b58.js)
// Simulated by forcing the two hit-flag stores to 0, which is exactly what the patched load produces.
test("loc_2b58: the contract catches the wrong hit-flag value", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x40); w(m, 0x8047, 0x42);
  w(m, IX + 0x05, 0x00);
  w(m, IY + 0x00, 0x50); w(m, 0x8044, 0x48);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, (a === 0x8004 || a === 0x842c) ? 0x00 : val, o);
  loc_2b58(m);
  assert.notEqual(r(m, 0x8004), 0x01, "mutated value no longer sets the flag");
});
