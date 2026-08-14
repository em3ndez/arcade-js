// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2af3 (Frogger IX sprite-object arm, ROM 0x2AF3-0x2B57). Gated on (ix+0x06);
// calls loc_2ae6 (stubbed as an SP-balancer), derives (iy+0x00) from (ix+0x04) vs 0x60, mirrors
// (ix+0x04) into (iy+0x03)/(iy+0x07), sets (iy+0x04), and on the wrap path zeroes ix[0..14]/iy[0..6]
// via ldir + stores (ix+0x0a)=0x20.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2af3 } from "../loc_2af3.js";

const IX = 0x8100;
const IY = 0x8200;
const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x2ae6, bal]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX; m.regs.iy = IY;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

test("loc_2af3: X<0x60 arm -- iy view from (0x8014)-(ix+0x02), rets before the wrap ldir", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01); // gate open
  w(m, IX + 0x04, 0x40); // < 0x60 -> subtract branch
  w(m, 0x8014, 0x25);
  w(m, IX + 0x02, 0x20); // C = 0x25 - 0x20 = 0x05
  w(m, IX + 0x05, 0x00); // -> 0x0f + C path
  loc_2af3(m);
  assert.equal(r(m, IY + 0x00), 0x05, "(iy+0) = (0x8014)-(ix+2)");
  assert.equal(r(m, IY + 0x03), 0x40, "(iy+3) = (ix+4)");
  assert.equal(r(m, IY + 0x07), 0x40, "(iy+7) = (ix+4)");
  assert.equal(r(m, IY + 0x04), 0x14, "(iy+4) = 0x0f + C");
  assert.equal(r(m, IX + 0x0a), 0x00, "no wrap ldir: (ix+0x0a) untouched");
  assert.deepEqual(m.calls, [0x2ae6], "loc_2ae6 called once");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
});

test("loc_2af3: X>=0x60 arm -- iy view from (ix+0x03)", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x60); // >= 0x60 -> jr nc, use (ix+3)
  w(m, IX + 0x03, 0x33);
  w(m, IX + 0x05, 0x00);
  loc_2af3(m);
  assert.equal(r(m, IY + 0x00), 0x33, "(iy+0) = (ix+3)");
  assert.equal(r(m, IY + 0x03), 0x60, "(iy+3) = (ix+4)");
  assert.equal(r(m, IY + 0x04), 0x42, "(iy+4) = 0x0f + 0x33");
});

test("loc_2af3: wrap path zeroes ix[0..14]/iy[0..6] and stores (ix+0x0a)=0x20", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x40);
  w(m, 0x8014, 0x30);
  w(m, IX + 0x02, 0x30); // C = 0 -> via (ix+5)!=0 branch, ret nz not taken (A=c=0)
  w(m, IX + 0x05, 0x01); // nonzero -> 0xf1 + C branch
  w(m, IX + 0x07, 0x01); // nonzero -> take the wrap ldir
  loc_2af3(m);
  for (let i = 0; i <= 15; i++) {
    if (i === 0x0a) continue;
    assert.equal(r(m, IX + i), 0x00, `ix[${i}] zeroed`);
  }
  assert.equal(r(m, IX + 0x0a), 0x20, "(ix+0x0a) = 0x20");
  for (let i = 0; i <= 7; i++) assert.equal(r(m, IY + i), 0x00, `iy[${i}] zeroed`);
  assert.deepEqual(m.calls, [0x2ae6], "loc_2ae6 called once");
  assert.equal(m.regs.sp, 0x8800, "SP balanced across two ldir + two pushes");
});

test("loc_2af3: (ix+0x06)==0 rets immediately (34 T), no call, no writes", () => {
  const m = mk();
  w(m, IX + 0x06, 0x00);
  w(m, IY + 0x00, 0xaa);
  loc_2af3(m);
  assert.equal(m.cycles, 34, "ld a,(ix+d)19 + or a 4 + ret z taken 11");
  assert.equal(r(m, IY + 0x00), 0xaa, "no write");
  assert.deepEqual(m.calls, [], "loc_2ae6 not called");
  assert.equal(m.regs.sp, 0x8800, "SP balanced");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2af3.js
//   find: regs.a = 0x0f;
//   repl: regs.a = 0x10;
//   expect: FAIL  ((iy+0x04) becomes 0x10+C = 0x15, not 0x0f+C = 0x14)
//   verified-anchor: count == 1  (the sole `regs.a = 0x0f;` in loc_2af3.js; `regs.a = 0xf1;` differs)
// Simulated by intercepting the (iy+0x04)=0x8204 store, which is exactly what the patched constant moves.
test("loc_2af3: the contract catches a wrong (iy+0x04) constant", () => {
  const m = mk();
  w(m, IX + 0x06, 0x01);
  w(m, IX + 0x04, 0x40);
  w(m, 0x8014, 0x25);
  w(m, IX + 0x02, 0x20);
  w(m, IX + 0x05, 0x00);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === (IY + 0x04) ? (val + 1) & 0xff : val, o);
  loc_2af3(m);
  assert.notEqual(r(m, IY + 0x04), 0x14, "mutated constant no longer matches the contract");
});
