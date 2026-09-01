// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_19e6 (ROM 0x19e6-0x19f9): HL:=0x2701, optional A-counted fill loop via
// loc_1439, both exits delegating into loc_19fa. Arm A = jz taken (skip loop); arm B = loop x2.
// Run: node --test games/invaders/translated/test/loc_19e6.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_19e6 } from "../loc_19e6.js";

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

test("loc_19e6 arm A: Z set -> skip loop, delegate loc_19fa; 20 T", () => {
  const m = makeMachine();
  m.regs.fZ = true;

  loc_19e6(m);

  assert.equal(m.regs.hl, 0x2701, "HL := 0x2701");
  assert.equal(m.tstates, 10 + 10, "T total: lxi(10)+jz taken(10)");
  assert.deepEqual(m.calls, [0x19fa], "delegates straight to loc_19fa");
  assert.deepEqual(m.pcSeq, [0x19e9, 0x19fa], "step boundaries");
});

test("loc_19e6 arm B: Z clear, A=2 -> loop twice via loc_1439, fall into loc_19fa; 138 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.fZ = false;
  m.regs.a = 0x02;

  loc_19e6(m);

  assert.equal(m.regs.hl, 0x2701, "HL := 0x2701");
  assert.equal(m.regs.de, 0x1c60, "DE := 0x1c60");
  assert.equal(m.regs.b, 0x10, "B := 0x10");
  assert.equal(m.regs.c, 0x01, "C holds the final loop count copy");
  assert.equal(m.regs.a, 0x00, "A counted down to 0");
  assert.equal(m.tstates, 20 + 59 + 59, "T total: header(20)+2x loop(59)");
  assert.deepEqual(m.calls, [0x1439, 0x1439, 0x19fa], "two fill calls then delegate");
  assert.equal(m.mem.read16(0x23fe), 0x19f5, "call 0x1439 return addr (pass 1)");
  assert.equal(m.mem.read16(0x23fc), 0x19f5, "call 0x1439 return addr (pass 2)");
});

test("loc_19e6 MUTATION: `call 0x1439` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.fZ = false;
  m.regs.a = 0x02;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1439 ? 11 : c);
  loc_19e6(m);
  assert.notEqual(m.tstates, 138, "golden T-state total catches the mutant");
});
