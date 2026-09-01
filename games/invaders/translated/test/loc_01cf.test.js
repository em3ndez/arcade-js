// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_01cf (ROM 0x01cf-0x01d8): seat A=1, B=0xe0, HL=0x2402 then tail-jump
// to loc_14cc (delegated). Pins the three register seats, the delegate target, and 34 T.
//
// Run: node --test games/invaders/translated/test/loc_01cf.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01cf } from "../loc_01cf.js";

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

test("loc_01cf: seats A=1, B=0xe0, HL=0x2402, delegates to loc_14cc; 34 T", () => {
  const m = makeMachine();

  loc_01cf(m);

  assert.equal(m.regs.a, 0x01, "A := 0x01");
  assert.equal(m.regs.b, 0xe0, "B := 0xe0");
  assert.equal(m.regs.hl, 0x2402, "HL := 0x2402");
  assert.deepEqual(m.calls, [0x14cc], "tail-delegates to loc_14cc");
  assert.equal(m.pc, 0x14cc, "last step lands at the delegate");
  assert.equal(m.tstates, 34, "7+7+10+10");
});

test("loc_01cf MUTATION: `lxi h` mis-charged 4T (not 10) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x01d6 ? 4 : c);
  loc_01cf(m);
  assert.equal(m.tstates, 28, "mutation loses 6 T (10 -> 4)");
  assert.notEqual(m.tstates, 34, "golden T-state total catches the mutant");
});
