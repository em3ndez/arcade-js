// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_19d7 (ROM 0x19d7-0x19da): A:=0 (xra a) then tail-jmp to loc_19d3.
// Run: node --test games/invaders/translated/test/loc_19d7.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_19d7 } from "../loc_19d7.js";

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

test("loc_19d7: A:=0, delegates to loc_19d3; 14 T", () => {
  const m = makeMachine();
  m.regs.a = 0xff; // prove xra a clears it

  loc_19d7(m);

  assert.equal(m.regs.a, 0x00, "A := 0 via xra a");
  assert.equal(m.regs.fZ, true, "xra a sets Z");
  assert.equal(m.tstates, 4 + 10, "T total: xra(4)+jmp(10)");
  assert.equal(m.pc, 0x19d3, "last step lands at loc_19d3 entry");
  assert.deepEqual(m.calls, [0x19d3], "tail-delegates to loc_19d3");
  assert.deepEqual(m.pcSeq, [0x19d8, 0x19d3], "step boundaries");
});

test("loc_19d7 MUTATION: `jmp 0x19d3` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19d3 ? 7 : c);
  loc_19d7(m);
  assert.notEqual(m.tstates, 14, "golden T-state total catches the mutant");
});
