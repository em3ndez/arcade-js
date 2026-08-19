// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_7740 (ROM 0x7740-0x778f): rst-0x28 state 1 -- advance one object and,
// on crossing a cell, queue its display + run the 5-byte guard loop over 0x0bb3. The 0x0020 stub
// models rst 0x20 (HL += A; A := (HL)) and balances its push; other delegated calls just balance.
//
// Run: node --test games/pooyan/translated/test/loc_7740.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7740 } from "../loc_7740.js";

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
      regs.sp = (regs.sp + 2) & 0xffff;
      if (a === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
  regs.sp = 0x8780; m.push16(CALLER_RET);
  return m;
}

// ── full crossing path: step position, queue display, run guard loop, exit 0x778f ───────────────
test("loc_7740: cell crossing -> advance state, display setup, guard loop, bump 0x89e9; 580 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8baa, 0x03); // (ix+0x0a) speed -> neg = 0xfd
  m.mem.write8(0x8ba3, 0xfe); // (ix+0x03) pos >= 0xfd -> jr nc taken (no borrow)
  m.mem.write8(0x8ba4, 0x05); // (ix+0x04) sub-pos &0x1f = 5 < 9 -> cross
  // guard table 0x0bb3..0x0bb7 = 0 -> checksum 0xc7 (non-zero) -> falls to 0x778b

  loc_7740(m);

  assert.equal(m.tstates, 580, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via final ret");
  assert.equal(m.regs.sp, 0x8780, "every delegated push balanced, ret popped caller");
  assert.deepEqual(m.calls, [0x4006, 0x0ef1, 0x0c45, 0x381e, 0x0020, 0x0020, 0x0020, 0x0020, 0x0020],
    "delegation order (guard loop runs rst 0x20 five times)");
  assert.equal(m.mem.read8(0x8ba3), 0x01, "(ix+0x03) = 0xfe + 0x03");
  assert.equal(m.mem.read8(0x8ba2), 0x01, "(ix+2) advanced 0 -> 1");
  assert.equal(m.mem.read8(0x8bb1), 0x18, "(ix+0x11) frame timer reloaded");
  assert.equal(m.mem.read8(0x89e9), 0x01, "guard non-zero -> tamper counter bumped");
  assert.equal(m.pcSeq.filter((p) => p === 0x7782).length, 5, "guard loop ran 5 iterations");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x7746, 0x7748, 0x7749, 0x774c, 0x774d, 0x7752, 0x7755, 0x7758, 0x7759, 0x775c,
     0x775e, 0x7760, 0x7761, 0x7764, 0x7768, 0x0ef1, 0x776e, 0x7771, 0x0c45, 0x381e, 0x777a,
     0x777c, 0x777d, 0x777e, 0x777f, 0x7780, 0x7782, 0x0020, 0x7784, 0x777f, 0x7780, 0x7782,
     0x0020, 0x7784, 0x777f, 0x7780, 0x7782, 0x0020, 0x7784, 0x777f, 0x7780, 0x7782, 0x0020,
     0x7784, 0x777f, 0x7780, 0x7782, 0x0020, 0x7784, 0x7786, 0x7787, 0x7788, 0x778a, 0x778b,
     0x778e, 0x778f, CALLER_RET],
    "step boundaries");
});

// ── sub-position still >= 9 -> early ret nc (no display) ─────────────────────────────────────────
test("loc_7740: sub-position still >= 9 -> ret nc; 169 T", () => {
  const m = makeMachine();
  m.regs.ix = 0x8ba0;
  m.mem.write8(0x8baa, 0x00); // speed 0 -> neg 0 -> B = 0
  m.mem.write8(0x8ba3, 0x10);
  m.mem.write8(0x8ba4, 0x09); // &0x1f = 9 >= 9 -> ret nc

  loc_7740(m);

  assert.equal(m.tstates, 169, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret nc");
  assert.deepEqual(m.calls, [0x4006], "only the entry refresh ran");
  assert.equal(m.pcSeq.at(-2), 0x7760, "exited at the ret nc");
});

test("loc_7740 MUTATION: a dropped `rst 0x20` step (lands 0x0020) loses 5*11 = 55 T", () => {
  const full = makeMachine();
  full.regs.ix = 0x8ba0;
  full.mem.write8(0x8baa, 0x03); full.mem.write8(0x8ba3, 0xfe); full.mem.write8(0x8ba4, 0x05);
  loc_7740(full);

  const mut = makeMachine();
  mut.regs.ix = 0x8ba0;
  mut.mem.write8(0x8baa, 0x03); mut.mem.write8(0x8ba3, 0xfe); mut.mem.write8(0x8ba4, 0x05);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0020 ? 0 : c); // the rst 0x20 opcode step
  loc_7740(mut);

  assert.equal(full.tstates - mut.tstates, 55, "the 5 guard-loop rst 0x20 steps contribute 11 T each");
  assert.notEqual(mut.tstates, 580, "a dropped step is caught");
});
