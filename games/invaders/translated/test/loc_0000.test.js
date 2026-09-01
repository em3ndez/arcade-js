// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0000 (ROM 0x0000-0x0005): the 8080 reset vector -- three NOPs then an
// unconditional JMP 0x18d4 into the init routine. No regs/memory change; this pins the four step
// boundaries, the exact T-states (MAME i8080: nop=4, jmp=10), and the tail-delegate via m.call.
//
// Run: node --test games/invaders/translated/test/loc_0000.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0000 } from "../loc_0000.js";

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

test("loc_0000: 3 nops + jmp 0x18d4, delegates via m.call; 22 T", () => {
  const m = makeMachine();

  loc_0000(m);

  assert.equal(m.tstates, 4 + 4 + 4 + 10, "T total: nop(4)*3 + jmp(10)");
  assert.equal(m.pc, 0x18d4, "last step lands at the init routine");
  assert.deepEqual(m.pcSeq, [0x0001, 0x0002, 0x0003, 0x18d4], "step boundaries");
  assert.deepEqual(m.calls, [0x18d4], "tail-delegate to loc_18d4");
  assert.equal(m.regs.sp, 0x0000, "reset vector pushes nothing");
  assert.equal(m.regs.a, 0x00, "no register writes");
});

test("loc_0000 MUTATION: jmp mis-charged as a nop (4T) not 10T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x18d4 ? 4 : c);
  loc_0000(m);
  assert.equal(m.tstates, 4 + 4 + 4 + 4, "mutation loses 6 T (jmp 10 -> 4)");
  assert.notEqual(m.tstates, 22, "golden T-state total catches the mutant");
});
