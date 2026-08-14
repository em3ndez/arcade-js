// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1198 (Frogger coord/offset compute, ROM 0x1198-0x11BE). Leaf, register-only:
// HL-0xA800 is the VRAM offset, then a 6-pass loop interleaves H/L bits into C and shifts L,H, and rets.
// No callees, so nothing to stub.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1198 } from "../loc_1198.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.cycles = 0;
  return m;
}

test("loc_1198: HL=0xa8c5, carry clear -> HL=0x3030, C=0x30, B=0; 455 T; rets", () => {
  const m = mk();
  m.regs.hl = 0xa8c5;
  m.regs.f &= ~0x01; // carry clear
  loc_1198(m);
  assert.equal(m.regs.hl, 0x3030, "HL bit-interleaved");
  assert.equal(m.regs.c, 0x30, "C column/tile index");
  assert.equal(m.regs.b, 0x00, "6 passes exhausted");
  assert.equal(m.cycles, 455, "exact T-states");
  assert.equal(m.pc, 0xbeef, "returned to caller");
});

test("loc_1198: a second offset HL=0xa933 -> HL=0x4808, C=0x48", () => {
  const m = mk();
  m.regs.hl = 0xa933;
  m.regs.f &= ~0x01;
  loc_1198(m);
  assert.equal(m.regs.hl, 0x4808);
  assert.equal(m.regs.c, 0x48);
});

test("loc_1198: incoming carry borrows into the sbc", () => {
  const m = mk();
  m.regs.hl = 0xa801;
  m.regs.f |= 0x01; // carry set -> HL = 0xa801-0xa800-1 = 0x0000
  loc_1198(m);
  assert.equal(m.regs.hl, 0x0000, "borrow taken");
  assert.equal(m.regs.c, 0x00);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1198.js
//   find: regs.and(0xe0);
//   repl: regs.and(0xf0);
//   expect: FAIL (masks L to bits 7..4 not 7..5; for low byte 0xd5 the seed changes 0xc0 -> 0xd0,
//           so the interleaved HL becomes 0x3434 not 0x3030)
//   verified-anchor: the sole `regs.and(0xe0)` in loc_1198.js; applied/ran/reverted.
test("loc_1198: the exact HL contract pins the initial L mask (0xe0, not 0xf0)", () => {
  const m = mk();
  m.regs.hl = 0xa8d5; // low byte 0xd5: &0xe0=0xc0 vs &0xf0=0xd0 -- masks diverge here
  m.regs.f &= ~0x01;
  loc_1198(m);
  assert.equal(m.regs.hl, 0x3030, "0xd5 & 0xe0 = 0xc0 seed");
});
