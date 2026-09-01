// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_08d1 (ROM 0x08d1-0x08d7): A := (port2 & 3) + 3, then ret.
//
// Run: node --test games/invaders/translated/test/loc_08d1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_08d1 } from "../loc_08d1.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x08d1, pcSeq: [],
    io: { ins: {}, outs: [], portIn(p) { return this.ins[p] ?? 0; }, portOut(p, v) { this.outs.push([p, v]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

test("loc_08d1: A := (port2 & 3) + 3", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.io.ins[0x02] = 0x06; // & 3 = 2; + 3 = 5

  loc_08d1(m);

  assert.equal(m.regs.a, 0x05, "A := (0x06 & 3) + 3 = 5");
  assert.equal(m.regs.fC, false, "0x02 + 0x03 = 0x05, no carry");
  assert.equal(m.tstates, 10 + 7 + 7 + 10, "T total");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.calls, [], "no sub-calls");
  assert.deepEqual(m.pcSeq, [0x08d3, 0x08d5, 0x08d7, CALLER_RET], "step boundaries");
  assert.equal(m.regs.sp, 0x2400, "stack unwound by ret");
});

test("loc_08d1: masks off high port bits (0xff & 3 = 3, +3 = 6)", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.io.ins[0x02] = 0xff;

  loc_08d1(m);

  assert.equal(m.regs.a, 0x06, "A := (0xff & 3) + 3 = 6");
});

test("loc_08d1 MUTATION: adi mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.io.ins[0x02] = 0x06;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x08d7 ? 4 : c);
  loc_08d1(m);
  assert.equal(m.tstates, 10 + 7 + 4 + 10, "mutation loses 3 T");
  assert.notEqual(m.tstates, 34, "golden T-state total catches the mutant");
});
