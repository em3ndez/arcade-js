// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2bab (Frogger IX sprite-object arm, ROM 0x2BAB-0x2BFA). IX = object struct at
// 0x8490, IY = sprite slot at 0x8058 (caller's values at 0x29AD/0x29B1). Exercises the (0x8004)==0
// path: the countdown (ix+0x09) expires, the compare picks the clear arm, which zeroes the 16-byte
// struct at IX and the 4-byte block at 0x8058.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2bab } from "../loc_2bab.js";

const IX = 0x8490, IY = 0x8058;
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  return m;
}

function setupClear(m) {
  for (let a = IX; a <= IX + 0x0f; a++) w(m, a, 0xff); // prefill struct
  for (let a = 0x8058; a <= 0x805b; a++) w(m, a, 0xff); // prefill IY block
  w(m, IX + 0x06, 0x03); // active
  w(m, IX + 0x09, 0x01); // countdown -> dec to 0
  w(m, IX + 0x0b, 0x40); // HL = 0x8040
  w(m, IX + 0x05, 0x01); // nonzero -> main compare arm
  w(m, IX + 0x00, 0x10);
  w(m, 0x8040, 0x50);    // table byte
  w(m, 0x8058, 0x20);    // (iy+0x00) for the cp
  w(m, 0x8004, 0x00);    // on-screen -> take the clear
}

function check(m) {
  for (let a = IX; a <= IX + 0x0f; a++) assert.equal(r(m, a), 0x00, `struct 0x${a.toString(16)} cleared`);
  for (let a = 0x8058; a <= 0x805b; a++) assert.equal(r(m, a), 0x00, `block 0x${a.toString(16)} cleared`);
}

test("loc_2bab: countdown expiry + (0x8004)==0 clears the struct and IY block; 679 T", () => {
  const m = mk();
  setupClear(m);
  loc_2bab(m);
  check(m);
  assert.equal(m.cycles, 679, "full clear path incl. two ldir runs");
});

test("loc_2bab: (ix+0x06)==0 rets immediately; 34 T", () => {
  const m = mk();
  w(m, IX + 0x06, 0x00);
  loc_2bab(m);
  assert.equal(m.cycles, 34, "ld(ix)19 + or 4 + ret z 11");
});

test("loc_2bab: countdown not expired decrements and rets; 62 T", () => {
  const m = mk();
  w(m, IX + 0x06, 0x03);
  w(m, IX + 0x09, 0x05);
  loc_2bab(m);
  assert.equal(r(m, IX + 0x09), 0x04, "(ix+0x09) decremented, not reloaded");
  assert.equal(m.cycles, 62, "..+ dec 23 + ret nz 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2bab.js
//   find: regs.bc = 0x000f;
//   repl: regs.bc = 0x000e;   // clears one fewer struct byte
//   expect: FAIL  (0x849f never written, so it keeps its 0xff prefill -> check throws)
//   verified-anchor: count == 1  (the sole regs.bc = 0x000f in loc_2bab.js)
test("loc_2bab: a short struct-clear count leaves the last byte dirty", () => {
  const m = mk();
  setupClear(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => { if (a === 0x849f) return; return ow(a, val, o); };
  loc_2bab(m);
  assert.throws(() => check(m));
});
