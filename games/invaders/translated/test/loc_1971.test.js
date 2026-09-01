// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1971 (ROM 0x1971-0x1978): set (0x206d):=1, tail-delegate to loc_16e6.
//
// Run: node --test games/invaders/translated/test/loc_1971.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1971 } from "../loc_1971.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1971: (0x206d):=1, delegates to loc_16e6; 30 T", () => {
  const m = makeMachine();
  loc_1971(m);
  assert.equal(m.regs.a, 0x01, "A := 0x01");
  assert.equal(m.mem.read8(0x206d), 0x01, "(0x206d) := 0x01");
  assert.equal(m.tstates, 7 + 13 + 10, "T: mvi+sta+jmp");
  assert.equal(m.pc, 0x16e6, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x16e6], "tail-delegates to loc_16e6");
  assert.deepEqual(m.pcSeq, [0x1973, 0x1976, 0x16e6], "step boundaries");
});

test("loc_1971 MUTATION: (0x206d) written as 0 (flag never set) is caught", () => {
  const m = makeMachine();
  const realWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v) => realWrite(a, a === 0x206d ? 0x00 : v);
  loc_1971(m);
  assert.notEqual(m.mem.read8(0x206d), 0x01, "the golden (0x206d)==1 catches the mutant");
});
