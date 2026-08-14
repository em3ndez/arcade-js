// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_28bb (Frogger frog-vs-diver collision test, ROM 0x28BB-0x2905). Gated on
// (0x8150) bit0 and dive phase (0x83b7)>=2, it box-checks the frog against the diver's Y ((0x8047)) and
// X ((0x8101)) extents. An inner-box overlap calls the frog-kill tail 0x12D0 (stubbed [B3*]); an outer
// overlap (jr nc,0x28ef) stamps the mounted-frog tiles 0x68/0x69/0x6A/0x6B and sets (0x8004)=1.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_28bb } from "../loc_28bb.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = [0x12d0];

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map(STUBS.map((a) => [a, bal])));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, val) => { m.mem.workRam[a - 0x8000] = val; };
const v = (m, i) => m.mem.videoRam[i];

test("loc_28bb: (0x8150) bit0==0 -> ret z; 32 T", () => {
  const m = mk();
  w(m, 0x8150, 0x00);
  loc_28bb(m);
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 32, "ld a,(nn) 13 + bit 0,a 8 + ret z taken 11");
  assert.deepEqual(m.calls, [], "no kill, no stamp");
});

test("loc_28bb: phase < 2 -> ret c, no collision test", () => {
  const m = mk();
  w(m, 0x8150, 0x01); w(m, 0x83b7, 0x00);
  loc_28bb(m);
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.deepEqual(m.calls, [], "gated out before any box test");
});

// Frog X ((0x8044)) inside the diver's inner box -> the kill tail 0x12D0.
test("loc_28bb: inner-box overlap calls the frog-kill tail 0x12D0", () => {
  const m = mk();
  w(m, 0x8150, 0x01); w(m, 0x83b7, 0x02);
  w(m, 0x8047, 0x30); w(m, 0x8044, 0x30); w(m, 0x8101, 0x30);
  loc_28bb(m);
  assert.deepEqual(m.calls, [0x12d0], "kill tail invoked");
  assert.equal(m.pc, 0xbeef, "ret after the kill");
  assert.equal(m.regs.sp, 0x8800, "call frame unwound");
  assert.equal(r(m, 0x8004), 0x00, "(0x8004) not set on the kill path");
});

function setRide(m) {
  w(m, 0x8150, 0x01); w(m, 0x83b7, 0x02);
  w(m, 0x8047, 0x30); w(m, 0x8044, 0x30); w(m, 0x8101, 0x48);
}
function checkRide(m) {
  assert.equal(r(m, 0x8004), 0x01, "(0x8004) = 1 -- mounted");
  assert.equal(v(m, 0x046), 0x68, "(0xa846) = 0x68");
  assert.equal(v(m, 0x047), 0x69, "(0xa847) = 0x69");
  assert.equal(v(m, 0x066), 0x6a, "(0xa866) = 0x6a");
  assert.equal(v(m, 0x067), 0x6b, "(0xa867) = 0x6b");
}

test("loc_28bb: outer-box overlap stamps the mounted-frog tiles", () => {
  const m = mk();
  setRide(m);
  loc_28bb(m);
  checkRide(m);
  assert.deepEqual(m.calls, [], "no kill on the ride path");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
});

test("loc_28bb: diver box entirely right of the frog -> ret c, no stamp", () => {
  const m = mk();
  w(m, 0x8150, 0x01); w(m, 0x83b7, 0x02);
  w(m, 0x8047, 0x30); w(m, 0x8044, 0x30); w(m, 0x8101, 0x80);
  loc_28bb(m);
  assert.equal(r(m, 0x8004), 0x00, "no mount");
  assert.deepEqual(m.calls, [], "no kill");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_28bb.js
//   find: mem.write8(regs.hl, 0x68);
//   repl: mem.write8(regs.hl, 0x78);   // wrong top-left mounted-frog tile
//   expect: FAIL  ((0xa846) = 0x78 instead of 0x68 -- caught by checkRide)
//   verified-anchor: count == 1  (the sole 0x68 store in loc_28bb.js)
// Simulated by intercepting the 0x68 store, which is what the edit produces.
test("loc_28bb: the contract catches a wrong mounted-frog tile", () => {
  const m = mk();
  setRide(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x68 ? 0x78 : val, o);
  loc_28bb(m);
  assert.throws(() => checkRide(m));
});
