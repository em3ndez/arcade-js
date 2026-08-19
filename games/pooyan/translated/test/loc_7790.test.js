// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7790 (ROM 0x7790-0x77c7): rst-0x28 state 2 -- draw one object twice
// (rows y and y-0x20 via the -0x400 pointer offset), set the drawn flag, then fall through into
// loc_77c8. Returning calls (0x4006/0x0c45/0x780f) balance their push; the tail-fall to 0x77c8 is
// record-only, so the caller return stays seated for loc_77c8 to consume.
//
// Run: node --test games/pooyan/translated/test/loc_7790.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7790 } from "../loc_7790.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) {
      this.calls.push(a);
      if (a !== 0x77c8) regs.sp = (regs.sp + 2) & 0xffff; // tail-fall to 0x77c8 pushed nothing
      if (a === 0x0c45) regs.de = 0xbeef;
      return undefined;
    },
  };
  regs.sp = 0x8780; m.push16(CALLER_RET);
  return m;
}

// ── timer expired -> draw twice, set flag, fall into loc_77c8 ────────────────────────────────────
test("loc_7790: timer expires -> two 0x780f blits, set (0x8d58), fall into 0x77c8; 306 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8bb1, 0x01); // (ix+0x11)=1 -> dec -> 0 -> draw
  m.mem.write8(0x8ba3, 0x00); // (ix+0x13) sprite index
  m.mem.write8(0x8ba5, 0x00); m.mem.write8(0x8ba6, 0x84); // (ix+0x15/16) screen ptr 0x8400
  m.mem.write8(0x8d58, 0x00); // drawn flag clear -> set to 1

  loc_7790(m);

  assert.equal(m.tstates, 306, "T total");
  assert.equal(m.pc, 0x77c8, "tail-falls into loc_77c8");
  assert.equal(m.regs.sp, 0x877e, "returning pushes balanced; caller return still seated");
  assert.equal(m.mem.read16(m.regs.sp), CALLER_RET, "loc_77c8 will ret to loc_7707's caller");
  assert.deepEqual(m.calls, [0x4006, 0x0c45, 0x780f, 0x0c45, 0x780f, 0x77c8], "delegation order");
  assert.equal(m.mem.read8(0x8d58), 0x01, "drawn flag set");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x7796, 0x7797, 0x779a, 0x779d, 0x0c45, 0x77a3, 0x77a6, 0x780f, 0x77ac, 0x77af,
     0x0c45, 0x77b5, 0x77b8, 0x77bb, 0x77bc, 0x780f, 0x77c2, 0x77c3, 0x77c4, 0x77c6, 0x77c8],
    "step boundaries");
});

// ── timer not yet expired -> ret nz ─────────────────────────────────────────────────────────────
test("loc_7790: timer still counting -> ret nz; 51 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8bb1, 0x05); // dec -> 4 (non-zero)

  loc_7790(m);

  assert.equal(m.tstates, 51, "T total (call 17 + dec 23 + ret 11)");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.calls, [0x4006], "only the entry refresh ran");
  assert.deepEqual(m.pcSeq, [0x4006, 0x7796, CALLER_RET], "step boundaries");
});

test("loc_7790 MUTATION: `add hl,bc` at 0x77bc mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8bb1, 0x01);
  m.mem.write8(0x8ba6, 0x84);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x77bc ? 7 : c);
  loc_7790(m);
  assert.equal(m.tstates, 302, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 306, "golden T-state total catches the mutant");
});
