// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_013b (ROM 0x013b-0x0140): DE := DE + 0x0030 through HL, then ret.
// Pins DE/HL after the xchg, carry, T-states, and the caller return the ret pops.
//
// Run: node --test games/invaders/translated/test/loc_013b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_013b } from "../loc_013b.js";

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

test("loc_013b: DE += 0x30 via HL, xchg, ret; 34 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(0x1234); // caller return
  m.regs.de = 0x0010;

  loc_013b(m);

  assert.equal(m.regs.de, 0x0040, "DE := 0x0030 + 0x0010 (after xchg)");
  assert.equal(m.regs.hl, 0x0010, "HL := old DE (after xchg)");
  assert.equal(m.regs.fC, false, "dad had no 16-bit carry");
  assert.equal(m.tstates, 10 + 10 + 4 + 10, "lxi+dad+xchg+ret");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, 0x1234, "ret pops the caller return");
  assert.equal(m.regs.sp, 0x2400, "SP balanced");
});

test("loc_013b MUTATION: dad d mis-charged 4T not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(0x1234);
  m.regs.de = 0x0010;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x013f ? 4 : c); // 0x013f is the addr AFTER dad d
  loc_013b(m);
  assert.notEqual(m.tstates, 34, "golden T-state total catches the mis-charged dad");
});
