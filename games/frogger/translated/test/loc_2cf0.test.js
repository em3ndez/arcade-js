// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_2cf0 (Frogger coin/credit scan, ROM 0x2CF0-0x2D87). Boot path latches
// ~IN0 & 0xC4 into 0x83E2 and returns; on a coin-release edge two computed jp(hl) dispatches
// index an interior jr-table by the coinage word DE=(0x83D4) and add BCD credit at 0x83E1.
// Test 2 exercises the cracked dispatch — different coinage indices select different credits.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2cf0 } from "../loc_2cf0.js";

function mk(in0) {
  const routines = new Map();
  for (const a of [0x0794, 0x0db9, 0x0b67]) routines.set(a, (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; });
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  const orr = m.mem.read8.bind(m.mem);
  m.mem.read8 = (a) => (a === 0xe000 ? in0 : orr(a));
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_2cf0: boot path latches ~IN0 & 0xC4 into 0x83E2; 69 T, no credit path", () => {
  const m = mk(0x3b);
  loc_2cf0(m);
  assert.equal(r(m, 0x83e2), 0xc4, "(0x83e2) = ~0x3B & 0xC4");
  assert.equal(m.cycles, 69, "boot-path T-total");
  assert.equal(m.regs.sp, 0x8800, "ret balanced back to the caller top");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.deepEqual(m.calls, [], "no coin-path calls at boot");
});

test("loc_2cf0: the coinage word DE=(0x83D4) selects the credit through the cracked jp(hl) table", () => {
  const m = mk(0xff);
  m.mem.workRam[0x3e2] = 0xc4; m.mem.workRam[0x3d4] = 0x04; m.mem.workRam[0x3fe] = 0x01;
  loc_2cf0(m);
  assert.equal(r(m, 0x83e1), 0x03, "DE=4 -> jp(hl) 0x2d3e -> jr 0x2d51 -> ld c,3 -> credit +3");
  assert.equal(r(m, 0x83e2), 0x00, "0x83e2 cleared as the coin is consumed");
  assert.deepEqual(m.calls, [0x0794], "the coin sound was issued");

  const m6 = mk(0xff);
  m6.mem.workRam[0x3e2] = 0xc4; m6.mem.workRam[0x3d4] = 0x06; m6.mem.workRam[0x3fe] = 0x01;
  loc_2cf0(m6);
  assert.equal(r(m6, 0x83e1), 0x06, "DE=6 -> jr 0x2d55 -> ld c,6 -> credit +6 (index-sensitive)");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2cf0.js
//   find: m.step(0x2cf8, 13); // ld a,(0xe000) -- IN0 (no flag effect)
//   repl: m.step(0x2cf8, 12); // (undercharge the IN0 read by 1 T)
//   expect: FAIL  (0x83e2 unchanged -- IN0 read is state-invisible -- only the cycle total catches it)
//   verified-anchor: count == 1  (the sole ld a,(0xe000) in loc_2cf0.js)
test("loc_2cf0: the cycle assertion catches a mistimed (state-invisible) IN0 read", () => {
  const m = mk(0x3b);
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x2cf8 && t === 13 ? 12 : t);
  loc_2cf0(m);
  assert.equal(r(m, 0x83e2), 0xc4, "state UNCHANGED by the timing mutation");
  assert.equal(m.cycles, 68, "the 1-T undercharge is caught by the cycle total");
});
