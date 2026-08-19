// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_1cf6 (ROM 0x1cf6-0x1d0c): branch on (0x8988). Z -> delegate loc_1d15;
// NZ -> clear (0x880a), rst-0x10 fill, set (0x880d)=1, call 0x02e3, delegate loc_1d0d. Flat-RAM
// mock, real Regs. rst 0x10 and call 0x02e3 are pattern-A; the stub runs m.ret() to pop the
// pushed return (a record-only stub would hide a stack bug).
//
// Run: node --test games/pooyan/translated/test/loc_1cf6.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1cf6 } from "../loc_1cf6.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

// pattern-A stub: pop the pushed return so the two-call stack sequence is exercised for real.
function installPatternAStub(m) {
  m.call = (addr) => { m.calls.push(addr); if (addr !== 0x1d0d) m.ret(); return undefined; };
}

// ── Path Z: (0x8988)==0 -> delegate loc_1d15 ──────────────────────────────────────────────────
test("loc_1cf6 Path Z: (0x8988)==0 -> delegate 0x1d15; 29 T", () => {
  const m = makeMachine();
  m.mem.write8(0x8988, 0x00);

  loc_1cf6(m);

  assert.equal(m.tstates, 29, "T total (13 + 4 + 12)");
  assert.equal(m.regs.a, 0x00, "A = (0x8988) = 0");
  assert.deepEqual(m.calls, [0x1d15], "delegate to loc_1d15 only");
  assert.deepEqual(m.pcSeq, [0x1cf9, 0x1cfa, 0x1d15], "Path Z boundaries");
});

// ── Path NZ: (0x8988)!=0 -> fill, (0x880d)=1, call 0x02e3, delegate loc_1d0d ────────────────────
test("loc_1cf6 Path NZ: (0x8988)!=0 -> seed + call 0x02e3 + delegate 0x1d0d; 123 T", () => {
  const m = makeMachine();
  installPatternAStub(m);
  m.regs.sp = 0x8780;
  m.mem.write8(0x8988, 0x07);

  loc_1cf6(m);

  // 103 T (own ops) + 2 stub rets x 10 (rst 0x10 + call 0x02e3 pop their pattern-A returns)
  assert.equal(m.tstates, 123, "Path NZ T total incl. two pattern-A stub rets");
  assert.equal(m.mem.read8(0x880a), 0x00, "(0x880a) cleared");
  assert.equal(m.mem.read8(0x880d), 0x01, "(0x880d) = 1 (inc a after xor a)");
  assert.equal(m.regs.a, 0x01, "A = 1");
  assert.equal(m.regs.hl, 0x8940, "HL = fill base (stub leaves it)");
  assert.equal(m.regs.b, 0x3f, "B = fill count (stub leaves it)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced across both pattern-A calls");
  assert.deepEqual(m.calls, [0x0010, 0x02e3, 0x1d0d], "rst 0x10, call 0x02e3, delegate loc_1d0d");
  assert.deepEqual(m.pcSeq,
    [0x1cf9, 0x1cfa, 0x1cfc, 0x1cfd, 0x1d00, 0x1d03, 0x1d05, 0x0010, 0x1d06,
     0x1d07, 0x1d0a, 0x02e3, 0x1d0d],
    "Path NZ boundaries (each pattern-A call steps into target then rets to next op)");
});

test("loc_1cf6 MUTATION: ld a,(0x8988) mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.mem.write8(0x8988, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1cf9 ? 7 : c);

  loc_1cf6(m);

  assert.equal(m.tstates, 23, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 29, "golden T-state total catches the mutant");
});
