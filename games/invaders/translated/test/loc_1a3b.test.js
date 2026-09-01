// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1a3b (ROM 0x1a3b-0x1a46): read 5-byte descriptor at (HL) into
// DE, A, C, B; then H:=C, L:=A; ret. Pins every register the descriptor fetch sets.
// Run: node --test games/invaders/translated/test/loc_1a3b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a3b } from "../loc_1a3b.js";

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
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_1a3b: fetch descriptor into DE/A/C/B, HL:=(C,A), ret; 75 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.hl = 0x2100;
  m.ram[0x2100] = 0x11; // -> E
  m.ram[0x2101] = 0x22; // -> D
  m.ram[0x2102] = 0x33; // -> A -> L
  m.ram[0x2103] = 0x44; // -> C -> H
  m.ram[0x2104] = 0x55; // -> B

  loc_1a3b(m);

  assert.equal(m.regs.de, 0x2211, "DE := (D,E) = (0x22,0x11)");
  assert.equal(m.regs.a, 0x33, "A := byte 3");
  assert.equal(m.regs.c, 0x44, "C := byte 4");
  assert.equal(m.regs.b, 0x55, "B := byte 5");
  assert.equal(m.regs.hl, 0x4433, "HL := (C,A) = (0x44,0x33)");
  assert.equal(m.tstates, 75, "T total for the 12-instruction fetch + ret");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return addr");
  assert.equal(m.regs.sp, 0x2400, "SP balanced");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_1a3b MUTATION: `mov e,m` mis-charged 5T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.hl = 0x2100;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a3c ? 5 : c); // 0x1a3c is the addr AFTER mov e,m
  loc_1a3b(m);
  assert.notEqual(m.tstates, 75, "golden T-state total catches the mutant");
});
