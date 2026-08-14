// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_16f8 (ROM 0x16F8-0x1801) — frog death / hop-complete animation. Gated by
// (0x8004); ticks (0x8247) and at 0x10 advances phase (0x81B2), then dispatches to the
// board-advance arm (loc_0804) or the per-phase tile pokes (rst 0x18). Callees loc_25ce/loc_27b3/
// loc_2856/loc_0804 and rst 0x18 (loc_0018) are SP-balancer stubs, asserted in call order.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_16f8 } from "../loc_16f8.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };
const STUBS = () => new Map([
  [0x25ce, bal], [0x27b3, bal], [0x2856, bal], [0x0804, bal], [0x0018, bal],
]);

function mk() {
  const m = new Machine(new Uint8Array(0x4000), STUBS());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const set = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

test("loc_16f8: (0x8004)==0 returns immediately; 28 T, no calls", () => {
  const m = mk();
  set(m, 0x8004, 0x00);
  loc_16f8(m);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + and a 4 + ret z taken 11");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.deepEqual(m.calls, [], "no calls");
});

test("loc_16f8: counter not yet 0x10 — bumps (0x8247), rets after the two helpers", () => {
  const m = mk();
  set(m, 0x8004, 0x01);
  set(m, 0x8150, 0x00); // bit 0 clear -> skip the 0x8118 write
  set(m, 0x8120, 0x00); // zero -> skip the 0x8121 write
  set(m, 0x8247, 0x00); // inc -> 1; 1 - 0x10 != 0 -> ret nz
  loc_16f8(m);
  assert.equal(r(m, 0x8247), 0x01, "counter incremented and stored");
  assert.equal(r(m, 0x8046), 0x00, "advance body not reached");
  assert.equal(m.pc, 0xbeef, "returned to caller");
  assert.deepEqual(m.calls, [0x25ce, 0x27b3], "both per-frame helpers ran");
});

test("loc_16f8: bit 0 of (0x8150) set writes 0x8118; (0x8120) nonzero copies to 0x8121", () => {
  const m = mk();
  set(m, 0x8004, 0x01);
  set(m, 0x8150, 0x01); // bit 0 set -> (0x8118) = 1
  set(m, 0x8120, 0x77); // nonzero -> (0x8121) = 0x77
  set(m, 0x8247, 0x00); // ret nz early, after the writes above
  loc_16f8(m);
  assert.equal(r(m, 0x8118), 0x01, "(0x8118) latched");
  assert.equal(r(m, 0x8121), 0x77, "(0x8120) copied to (0x8121)");
});

test("loc_16f8: phase>=5 tile-poke arm (block 0x17B4) stamps the tile and calls loc_2856", () => {
  const m = mk();
  set(m, 0x8004, 0x01);
  set(m, 0x8150, 0x00);
  set(m, 0x8120, 0x00);
  set(m, 0x8247, 0x0f); // inc -> 0x10 -> advance
  set(m, 0x829c, 0x00); // second bank not selected
  set(m, 0x81b2, 0x04); // inc -> 5 -> falls past the four jr-z arms to 0x17B4
  loc_16f8(m);
  assert.equal(r(m, 0x8045), 0x3c, "tile 0x3c stamped at HL=0x8044+1");
  assert.equal(r(m, 0x83ae), 0x00, "(0x83ae) cleared");
  assert.equal(r(m, 0x8382), 0xd8, "(0x8382) low = 0xd8");
  assert.equal(r(m, 0x8383), 0x00, "(0x8383) high = 0x00");
  assert.equal(r(m, 0x8247), 0x00, "counter reset");
  assert.equal(r(m, 0x81b2), 0x05, "phase advanced");
  assert.deepEqual(m.calls, [0x25ce, 0x27b3, 0x2856], "helpers then loc_2856");
});

test("loc_16f8: phase reaches 6 -> board-advance arm (calls loc_0804, clears the block)", () => {
  const m = mk();
  set(m, 0x8004, 0x01);
  set(m, 0x8150, 0x00);
  set(m, 0x8120, 0x00);
  set(m, 0x8247, 0x0f); // advance
  set(m, 0x829c, 0x00);
  set(m, 0x81b2, 0x05); // inc -> 6 == cp 0x06 -> fall into 0x1741
  set(m, 0x83d6, 0x01); // dec -> 0 -> continue past the first jr nz
  set(m, 0x83fe, 0x00); // and a -> Z -> continue to the final clears
  set(m, 0x8248, 0xee); // ldir target head
  set(m, 0x8253, 0xee); // ldir target tail
  loc_16f8(m);
  assert.equal(r(m, 0x8004), 0x00, "death gate cleared");
  assert.equal(r(m, 0x81b2), 0x00, "phase reset");
  assert.equal(r(m, 0x8247), 0x00, "counter cleared");
  assert.equal(r(m, 0x829c), 0x00, "second bank cleared");
  assert.equal(r(m, 0x8269), 0x00, "(0x8269) cleared");
  assert.equal(r(m, 0x83ce), 0x01, "(0x83ce) = 1");
  assert.equal(r(m, 0x8248), 0x00, "ldir head cleared");
  assert.equal(r(m, 0x8253), 0x00, "ldir tail cleared");
  assert.equal(r(m, 0x83d6), 0x00, "(0x83d6) cleared");
  assert.equal(r(m, 0x825b), 0x00, "(0x825b) cleared");
  assert.deepEqual(m.calls, [0x25ce, 0x27b3, 0x0804], "helpers then loc_0804");
});

test("loc_16f8: phase 1 tile-poke arm (block 0x179E) issues rst 0x18 twice", () => {
  const m = mk();
  set(m, 0x8004, 0x01);
  set(m, 0x8150, 0x00);
  set(m, 0x8120, 0x00);
  set(m, 0x8247, 0x0f); // advance
  set(m, 0x829c, 0x00);
  set(m, 0x81b2, 0x00); // inc -> 1 -> first jr-z arm (0x179E)
  loc_16f8(m);
  assert.equal(r(m, 0x8045), 0x39, "tile 0x39 stamped");
  assert.equal(r(m, 0x8382), 0x00, "(0x8382) low cleared");
  assert.equal(r(m, 0x8383), 0x00, "(0x8383) high cleared");
  assert.deepEqual(m.calls, [0x25ce, 0x27b3, 0x0018, 0x0018], "two tile-queue pokes");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_16f8.js
//   find: mem.write8(0x83ce, regs.a);
//   repl: mem.write8(0x83cf, regs.a);   // one operand nibble: ce -> cf
//   expect: FAIL  (0x83CE never set to 1)
//   verified-anchor: count == 1  (the sole write to 0x83ce in loc_16f8.js)
// Simulated by redirecting the 0x83ce store to 0x83cf, which is what the edit produces.
test("loc_16f8: the contract catches a redirected (0x83ce) store", () => {
  const m = mk();
  set(m, 0x8004, 0x01);
  set(m, 0x8150, 0x00);
  set(m, 0x8120, 0x00);
  set(m, 0x8247, 0x0f);
  set(m, 0x829c, 0x00);
  set(m, 0x81b2, 0x05);
  set(m, 0x83d6, 0x01);
  set(m, 0x83fe, 0x00);
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a === 0x83ce ? 0x83cf : a, v, o);
  loc_16f8(m);
  assert.throws(() => assert.equal(r(m, 0x83ce), 0x01));
});
