// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_18d4 (ROM 0x18d4-0x18de): boot init -- seats SP, clears B, calls the
// two init subroutines, tail-delegates into loc_18df. The mock records m.call targets rather than
// running them, so this pins the SP seat, the register writes, the exact T-states (MAME i8080),
// the two call return addresses, and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_18d4.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_18d4 } from "../loc_18d4.js";

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

test("loc_18d4: seats SP, clears B, calls 01e6+1956, delegates to 18df; 51 T", () => {
  const m = makeMachine();

  loc_18d4(m);

  assert.equal(m.regs.sp, 0x23fc, "SP: 0x2400 - two 2-byte pushes");
  assert.equal(m.regs.b, 0x00, "B := 0x00");
  assert.equal(m.tstates, 10 + 7 + 17 + 17, "T total: lxi(10)+mvi(7)+call(17)+call(17)");
  assert.equal(m.pc, 0x1956, "last step lands at the second callee");
  assert.deepEqual(m.calls, [0x01e6, 0x1956, 0x18df], "two calls then delegate to loc_18df");
  assert.deepEqual(m.pcSeq, [0x18d7, 0x18d9, 0x01e6, 0x1956], "step boundaries");
  assert.equal(m.mem.read16(0x23fe), 0x18dc, "call 0x01e6 pushes return addr 0x18dc");
  assert.equal(m.mem.read16(0x23fc), 0x18df, "call 0x1956 pushes return addr 0x18df");
});

test("loc_18d4 MUTATION: `call 0x1956` mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1956 ? 11 : c);
  loc_18d4(m);
  assert.equal(m.tstates, 10 + 7 + 17 + 11, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 51, "golden T-state total catches the mutant");
});
