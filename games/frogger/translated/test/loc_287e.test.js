// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for the loc_287e unit (Frogger dive-tail helpers, ROM 0x286D-0x28BA). Externally-entered
// labels are separate exports: loc_286d seeds HL=0x1403 then jp loc_281b; loc_2873 is a bare ret;
// loc_2874 conditionally calls loc_287e then jp loc_27fe; loc_287e / loc_288c both seed the surface
// tiles (0x8146)/(0x8147) from (0x819b)&0x0f via the shared block_289c; loc_28b0 steps (0x8147). All
// callees stubbed.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_286d, loc_2873, loc_2874, loc_287e, loc_288c, loc_28b0 } from "../loc_287e.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = [0x281b, 0x287e, 0x27fe];

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

test("loc_2873: bare ret to the caller; 10 T", () => {
  const m = mk();
  loc_2873(m);
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 10, "ret");
});

test("loc_286d: HL=0x1403 then jp loc_281b", () => {
  const m = mk();
  loc_286d(m);
  assert.equal(m.regs.hl, 0x1403, "HL seeded to the second anim table");
  assert.deepEqual(m.calls, [0x281b], "tail-jumps loc_281b");
});

test("loc_2874: (0x8101)==0 -> call loc_287e then jp loc_27fe", () => {
  const m = mk();
  w(m, 0x8101, 0x00);
  loc_2874(m);
  assert.deepEqual(m.calls, [0x287e, 0x27fe], "the conditional call then the tail-jump");
  assert.equal(m.regs.sp, 0x8800, "call frame unwound, delegate popped the caller");
});

test("loc_2874: (0x8101)!=0 -> skips the call, jp loc_27fe", () => {
  const m = mk();
  w(m, 0x8101, 0x05);
  loc_2874(m);
  assert.deepEqual(m.calls, [0x27fe], "no call z, straight to the tail-jump");
});

test("loc_287e: (0x814f)!=0 -> ret nz, no seed", () => {
  const m = mk();
  w(m, 0x814f, 0x01);
  loc_287e(m);
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(r(m, 0x8150), 0x00, "(0x8150) left untouched");
});

test("loc_287e: (0x814f)==0 -> (0x8150)=1 and seed the surface tiles", () => {
  const m = mk();
  w(m, 0x814f, 0x00); w(m, 0x819b, 0x03);
  loc_287e(m);
  assert.equal(r(m, 0x8150), 0x01, "(0x8150) = 1");
  assert.equal(r(m, 0x8146), 0x18, "(0x8146) = (0x819b&0x0f)*8");
  assert.equal(r(m, 0x8147), 0x18, "(0x8147) = same seed");
  assert.equal(r(m, 0x814f), 0x01, "(0x814f) latched");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
});

test("loc_288c: (0x814f)!=0 -> ret nz", () => {
  const m = mk();
  w(m, 0x814f, 0x01); w(m, 0x8150, 0x05);
  loc_288c(m);
  assert.equal(r(m, 0x8150), 0x05, "(0x8150) not bumped");
});

function set288c(m) {
  w(m, 0x814f, 0x00); w(m, 0x8150, 0x05); w(m, 0x819b, 0x0a);
}
function check288c(m) {
  assert.equal(r(m, 0x8150), 0x06, "(0x8150) += 1");
  assert.equal(r(m, 0x8146), 0x50, "(0x8146) = (0x819b&0x0f)*8 = 0x50");
  assert.equal(r(m, 0x8147), 0x50, "(0x8147) = same seed");
}

test("loc_288c: (0x814f)==0 -> bump (0x8150) and seed the tiles", () => {
  const m = mk();
  set288c(m);
  loc_288c(m);
  check288c(m);
  assert.equal(r(m, 0x814f), 0x01, "(0x814f) latched by block_289c");
});

test("loc_28b0: nonzero counter decrements", () => {
  const m = mk();
  m.regs.hl = 0x8147; w(m, 0x8147, 0x05);
  loc_28b0(m);
  assert.equal(r(m, 0x8147), 0x04, "dec (0x8147)");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
});

test("loc_28b0: zero counter reloads from (0x8146)", () => {
  const m = mk();
  m.regs.hl = 0x8147; w(m, 0x8147, 0x00); w(m, 0x8146, 0x22);
  loc_28b0(m);
  assert.equal(r(m, 0x8147), 0x22, "(0x8147) = (0x8146)");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_287e.js
//   find: regs.and(0x0f);
//   repl: regs.and(0x07);   // masks the dive-frame index to 3 bits instead of 4
//   expect: FAIL  ((0x819b)=0x0a seeds the tiles 0x50, not 0x10 -- caught by check288c)
//   verified-anchor: count == 1  (the sole `regs.and(0x0f)` in loc_287e.js)
// Simulated by intercepting the seed store 0x50 -> 0x10, which is what the edit produces for 0x0a.
test("loc_288c: the contract catches a mis-masked frame index", () => {
  const m = mk();
  set288c(m);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x50 ? 0x10 : val, o);
  loc_288c(m);
  assert.throws(() => check288c(m));
});
