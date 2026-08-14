// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_291d (Frogger score/lane-animation helper, ROM 0x291D-0x2968). Leaf, no
// callees. When (0x8101)==0 it clears (0x833F); else, gated by (0x8150) bit0 and (0x814F)==0, it bumps
// (0x833F) and at phase 0x40 / 0x70 blits two 2-tile figures at 0xA846 & 0xA866. Memory-equivalence.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_291d } from "../loc_291d.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };
const r = (m, a) => m.mem.workRam[a - 0x8000];
const v = (m, a) => m.mem.videoRam[a & 0x3ff];
// (0x8150) bit0 set + (0x814F) idle open the animate path.
function gate(m) { w(m, 0x8101, 0x01); w(m, 0x8150, 0x01); w(m, 0x814f, 0x00); }

test("loc_291d: (0x8101)==0 clears the phase and returns; 51 T", () => {
  const m = mk();
  w(m, 0x8101, 0x00); w(m, 0x833f, 0x55);
  loc_291d(m);
  assert.equal(r(m, 0x833f), 0x00, "(0x833f) cleared");
  assert.equal(m.cycles, 51, "13+4 +7 +4 +13 +10(ret)");
  assert.equal(m.pc, 0xbeef);
});

test("loc_291d: (0x8150) bit0 clear rets untouched (ret z)", () => {
  const m = mk();
  gate(m); w(m, 0x8150, 0x00); w(m, 0x833f, 0x10);
  loc_291d(m);
  assert.equal(r(m, 0x833f), 0x10, "phase not bumped");
});

test("loc_291d: (0x814F) busy rets untouched (ret nz)", () => {
  const m = mk();
  gate(m); w(m, 0x814f, 0x01); w(m, 0x833f, 0x10);
  loc_291d(m);
  assert.equal(r(m, 0x833f), 0x10, "phase not bumped");
});

test("loc_291d: an ordinary phase only advances the counter", () => {
  const m = mk();
  gate(m); w(m, 0x833f, 0x10);
  loc_291d(m);
  assert.equal(r(m, 0x833f), 0x11, "phase incremented, no blit");
  assert.equal(v(m, 0xa846), 0x00, "no tile written");
});

const checkA = (m) => {
  assert.equal(v(m, 0xa846), 0x68);
  assert.equal(v(m, 0xa847), 0x69);
  assert.equal(v(m, 0xa866), 0x6a);
  assert.equal(v(m, 0xa867), 0x6b);
};

test("loc_291d: phase reaching 0x40 blits the 0x68.. figure", () => {
  const m = mk();
  gate(m); w(m, 0x833f, 0x3f);
  loc_291d(m);
  assert.equal(r(m, 0x833f), 0x40, "phase now 0x40");
  checkA(m);
});

test("loc_291d: phase reaching 0x70 blits the 0xD0.. figure and restarts", () => {
  const m = mk();
  gate(m); w(m, 0x833f, 0x6f);
  loc_291d(m);
  assert.equal(v(m, 0xa846), 0xd0);
  assert.equal(v(m, 0xa847), 0xd1);
  assert.equal(v(m, 0xa866), 0xd2);
  assert.equal(v(m, 0xa867), 0xd3);
  assert.equal(r(m, 0x833f), 0x00, "phase reset to 0");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_291d.js
//   find: mem.write8(regs.hl, 0x6a);
//   repl: mem.write8(regs.hl, 0x6b);
//   expect: FAIL  (writes 0x6b at 0xA866 instead of 0x6a — caught by checkA)
//   verified-anchor: count == 1  (the sole `mem.write8(regs.hl, 0x6a)` in loc_291d.js)
// Simulated by intercepting the 0x6a store, which is what the edit produces.
test("loc_291d: the contract catches a wrong figure tile", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x6a ? 0x6b : val, o);
  gate(m); w(m, 0x833f, 0x3f);
  loc_291d(m);
  assert.throws(() => checkA(m));
});
