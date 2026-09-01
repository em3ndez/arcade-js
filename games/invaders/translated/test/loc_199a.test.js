// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_199a (ROM 0x199a-0x19bd): the 0x201e-gated port-1 poll. Two arms --
// (A) flag already set -> jump to loc_19ac, port-1 == 0x34 -> tail-jmp loc_08f3; (B) flag zero,
// port-1 code != 0x72 -> early rnz. Plus a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_199a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_199a } from "../loc_199a.js";

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
    io: { ins: {}, portIn(p) { return this.ins[p] & 0xff || 0; }, portOut(p, v) { (this.outs ||= []).push([p, v & 0xff]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_199a arm A: flag set -> loc_19ac, port1 0x34 -> delegate loc_08f3; 93 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x201e, 0x05); // flag already non-zero -> jnz taken
  m.io.ins[0x01] = 0x34;      // (0x34 & 0x76) == 0x34 -> cpi 0x34 Z

  loc_199a(m);

  assert.equal(m.tstates, 13 + 4 + 10 + 10 + 7 + 7 + 5 + 10 + 10 + 7 + 10, "T total arm A");
  assert.deepEqual(m.calls, [0x08f3], "tail-delegates to loc_08f3");
  assert.equal(m.pc, 0x08f3, "last step lands at the delegate");
  assert.equal(m.mem.read8(0x201e), 0x05, "flag untouched on this arm");
  assert.equal(m.regs.hl, 0x2e1b, "HL := 0x2e1b");
  assert.equal(m.regs.de, 0x0bf7, "DE := 0x0bf7");
  assert.equal(m.regs.c, 0x09, "C := 0x09");
  assert.equal(m.regs.a, 0x34, "A holds the masked port-1 code");
});

test("loc_199a arm B: flag zero, port1 code != 0x72 -> early rnz; 62 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.mem.write8(0x201e, 0x00); // flag zero -> jnz not taken
  m.io.ins[0x01] = 0x00;      // sui 0x72 -> non-zero -> rnz taken

  loc_199a(m);

  assert.equal(m.tstates, 13 + 4 + 10 + 10 + 7 + 7 + 11, "T total arm B (early rnz)");
  assert.deepEqual(m.calls, [], "no delegation on the early return");
  assert.equal(m.pc, CALLER_RET, "rnz pops the caller return addr");
  assert.equal(m.regs.sp, 0x2400, "SP restored after rnz");
  assert.equal(m.mem.read8(0x201e), 0x00, "flag not bumped (0x72 code not seen)");
});

test("loc_199a MUTATION: `in 0x01` at 0x19ac mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x201e, 0x05);
  m.io.ins[0x01] = 0x34;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19ae ? 7 : c);
  loc_199a(m);
  assert.notEqual(m.tstates, 93, "golden T-state total catches the mutant");
});
