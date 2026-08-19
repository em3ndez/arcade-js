// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_771d (ROM 0x771d-0x773f): rst-0x28 state 0 -- arm a new object, then
// fall through into state 1 (0x7740). The 0x0020 stub models rst 0x20 (HL += A; A := (HL)) and
// balances its push; the trailing fall-through call to 0x7740 is a black box (record-only).
//
// Run: node --test games/pooyan/translated/test/loc_771d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_771d } from "../loc_771d.js";

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
      if (a === 0x0020) { regs.sp = (regs.sp + 2) & 0xffff; regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
  regs.sp = 0x8780; m.push16(CALLER_RET);
  return m;
}

// ── countdown expired -> arm object, fall into state 1 ──────────────────────────────────────────
test("loc_771d: (ix+0x11) expires -> pull spawn index, look up word, fall into 0x7740; 208 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8bb1, 0x01);        // (ix+0x11)=1 -> dec -> 0 -> proceed
  m.mem.write8(0x8d57, 0x04);        // ring counter -> spawn index 4
  m.mem.write8(0x7869 + 8, 0xaa);    // word table[4] low  (index*2 = 8)
  m.mem.write8(0x7869 + 9, 0xbb);    // word table[4] high

  loc_771d(m);

  assert.equal(m.tstates, 208, "T total");
  assert.equal(m.pc, 0x7740, "tail-falls into state 1");
  assert.deepEqual(m.calls, [0x0020, 0x7740], "rst 0x20 lookup then fall into 0x7740");
  assert.equal(m.mem.read8(0x8bb3), 0x04, "(ix+0x13) = spawn index");
  assert.equal(m.mem.read8(0x8bb5), 0xaa, "(ix+0x15) = word low");
  assert.equal(m.mem.read8(0x8bb6), 0xbb, "(ix+0x16) = word high");
  assert.equal(m.mem.read8(0x8baa), 0xec, "(ix+0x0a) = 0xec speed seed");
  assert.equal(m.mem.read8(0x8ba2), 0x01, "(ix+2) advanced 0 -> 1");
  assert.equal(m.mem.read8(0x8d57), 0x05, "ring counter incremented");
  assert.deepEqual(m.pcSeq,
    [0x7720, 0x7721, 0x7724, 0x7725, 0x7726, 0x7727, 0x772a, 0x772b, 0x772e, 0x772f,
     0x0020, 0x7733, 0x7734, 0x7735, 0x7738, 0x773a, 0x773d, 0x7740],
    "step boundaries");
});

// ── countdown not yet expired -> ret nz ─────────────────────────────────────────────────────────
test("loc_771d: (ix+0x11) still counting -> ret nz; 34 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8bb1, 0x05); // dec -> 4 (non-zero)

  loc_771d(m);

  assert.equal(m.tstates, 34, "T total (dec 23 + ret 11)");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.mem.read8(0x8bb1), 0x04, "(ix+0x11) decremented");
  assert.deepEqual(m.calls, [], "no work while counting");
  assert.deepEqual(m.pcSeq, [0x7720, CALLER_RET], "step boundaries");
});

test("loc_771d MUTATION: `dec (ix+0x11)` at 0x7720 mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8bb1, 0x01);
  m.mem.write8(0x8d57, 0x04);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7720 ? 19 : c);
  loc_771d(m);
  assert.equal(m.tstates, 204, "mutation loses 4 T (23 -> 19)");
  assert.notEqual(m.tstates, 208, "golden T-state total catches the mutant");
});
