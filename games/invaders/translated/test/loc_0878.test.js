// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_0878 (ROM 0x0878-0x0882): B <- mem[0x2008], DE <- word[0x2009] (lhld+xchg,
// so the old DE lands in HL), then tail-jump to loc_0886. The mock's `call` pops the top of stack,
// modeling loc_0886's ret to the seated caller, so the tail delegation unwinds to baseline.
//
// Run: node --test games/invaders/translated/test/loc_0878.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0878 } from "../loc_0878.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0878, pcSeq: [],
    io: { ins: {}, outs: [], portIn(p) { return this.ins[p] ?? 0; }, portOut(p, v) { this.outs.push([p, v]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; }, // record + model callee ret
  };
}

test("loc_0878: B<-0x2008, DE<-word[0x2009], old DE->HL, tail to loc_0886", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.de = 0x5678;
  m.mem.write8(0x2008, 0x42);
  m.mem.write8(0x2009, 0x34);
  m.mem.write8(0x200a, 0x12);

  loc_0878(m);

  assert.equal(m.regs.b, 0x42, "B := mem[0x2008]");
  assert.equal(m.regs.de, 0x1234, "DE := word[0x2009] after xchg");
  assert.equal(m.regs.hl, 0x5678, "HL := old DE after xchg");
  assert.equal(m.tstates, 13 + 5 + 16 + 4 + 10, "T total");
  assert.equal(m.pc, 0x0886, "tail jmp lands on loc_0886");
  assert.deepEqual(m.calls, [0x0886], "delegates to loc_0886");
  assert.deepEqual(m.pcSeq, [0x087b, 0x087c, 0x087f, 0x0880, 0x0886], "step boundaries");
  assert.equal(m.regs.sp, 0x2400, "stack unwound (loc_0886 rets to caller)");
});

test("loc_0878 MUTATION: lhld mis-charged 13T (not 16T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x087f ? 13 : c);
  loc_0878(m);
  assert.equal(m.tstates, 13 + 5 + 13 + 4 + 10, "mutation loses 3 T");
  assert.notEqual(m.tstates, 48, "golden T-state total catches the mutant");
});
