// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1950 (ROM 0x1950-0x1955): seat HL=0x20f4, tail-delegate to loc_1931.
//
// Run: node --test games/invaders/translated/test/loc_1950.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1950 } from "../loc_1950.js";

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

test("loc_1950: HL:=0x20f4, delegates to loc_1931; 20 T", () => {
  const m = makeMachine();
  loc_1950(m);
  assert.equal(m.regs.hl, 0x20f4, "HL := 0x20f4");
  assert.equal(m.tstates, 10 + 10, "T: lxi + jmp");
  assert.equal(m.pc, 0x1931, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x1931], "tail-delegates to loc_1931");
  assert.deepEqual(m.pcSeq, [0x1953, 0x1931], "step boundaries");
});

test("loc_1950 MUTATION: jmp mis-charged 17T (call) not 10T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1931 ? 17 : c);
  loc_1950(m);
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
