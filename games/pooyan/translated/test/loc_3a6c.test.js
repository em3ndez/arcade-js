// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_3a6c (ROM 0x3a6c-0x3b29): launch an actor into a free 0x8be8 slot.
// Flat-RAM mock (real Regs). loc_0c45 / loc_381e / loc_0020 (rst 0x20) are plain-ret routines, so
// each call site is pattern-A (push return, then call); the stub runs m.ret() to pop that return so
// the two-deep stack discipline is exercised for real (a record-only stub would hide a stack bug).
//
// Run: node --test games/pooyan/translated/test/loc_3a6c.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3a6c } from "../loc_3a6c.js";

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
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // pattern-A stub: record the target, then pop the pushed return via m.ret()
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// ── Path 1: all 3 candidate slots occupied -> scan exhausts, ret ───────────────────────────────
test("loc_3a6c Path 1: no free slot -> ret; 288 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c00;
  for (let i = 0; i < 3; i++) m.mem.write8(0x8be8 + i * 0x18, 0x01); // (iy+0) bit0 set = occupied

  loc_3a6c(m);

  assert.equal(m.tstates, 288, "Path 1 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8d42), 1, "spawn counter (0x8d42) bumped");
  assert.deepEqual(m.calls, [], "no free slot: no helper calls");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

// ── Path 2: first slot free -> full init (all branches take the fall-through/default arm) ───────
// Total = loc_3a6c's own 825 T + 3 pattern-A callee rets (10 T each, from the stub) = 855 T.
test("loc_3a6c Path 2: first slot free -> seed IY record; 855 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c00;
  m.mem.write8(0x8c06, 0x2a);   // (ix+6) heading source; (0x2a-6)>>1 & 7 = 0x12>>1&7 = 1
  m.mem.write8(0x8c08, 0x40);   // (ix+8) start; ends 0x40-0x10 = 0x30
  m.mem.write8(0x8907, 0x00);   // bit0=0 & bit2=0 -> default table / hit-flash arms
  m.mem.write8(0x8f50, 0x00);   // -> DE = 0x3bdd arm
  m.mem.write8(0x8c07, 0x00);   // (ix+7) bit1 = 0
  m.mem.write8(0x8c16, 0x00);   // (ix+16)&0x30 != 0x30

  loc_3a6c(m);

  assert.equal(m.tstates, 855, "Path 2 T-state total (all default arms)");
  assert.equal(m.pc, CALLER_RET, "returns to caller after seeding");
  assert.equal(m.mem.read8(0x8d42), 1, "spawn counter bumped");
  assert.equal(m.mem.read8(0x8be8 + 0x00), 0x01, "(iy+0) marked active");
  assert.equal(m.mem.read8(0x8be8 + 0x02), 0x0b, "(iy+2) seeded");
  assert.equal(m.mem.read8(0x8be8 + 0x11), 0x13, "(iy+0x11) seeded");
  assert.equal(m.mem.read8(0x8c08), 0x30, "(ix+8) nudged by -0x10");
  // heading index = 1 was moved to A before rst 0x20; the pattern-A stub leaves A unchanged, so
  // (ix+0x15) records that pre-rst A value here.
  assert.equal(m.mem.read8(0x8c15), 0x01, "(ix+0x15) := A at the rst 0x20 site (index 1)");
  assert.deepEqual(m.calls, [0x0c45, 0x381e, 0x0020], "helper calls in order");
  assert.equal(m.regs.sp, 0x8780, "stack balanced across 3 pattern-A calls");
  assert.equal(m.pcSeq[0], 0x3a6f, "starts at 0x3a6f");
  assert.equal(m.pcSeq[m.pcSeq.length - 1], CALLER_RET, "ends at caller");
  assert.ok(m.pcSeq.includes(0x3a87), "took the free-slot branch to 0x3a87");
});

test("loc_3a6c MUTATION: set 0,(iy+0x08) mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3aaf ? 19 : c); // 0x3aaf is the landing after set 0,(iy+8)
  loc_3a6c(m);
  assert.notEqual(m.tstates, 855, "golden total catches the 4T undercharge");
  assert.equal(m.tstates, 851, "mutation loses exactly 4 T");
});
