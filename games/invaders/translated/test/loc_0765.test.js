// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0765 (ROM 0x0765-0x077e): A:=1 -> [0x2093], seat SP, EI, three
// subroutine calls, then fall through into loc_077f. Pins the memory write, register loads, the
// call return addresses, the exact T-states, and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_0765.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0765 } from "../loc_0765.js";

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
    io: { inte: false, setInte(v) { this.inte = !!v; } },
  };
}

test("loc_0765: seats state, calls 1979+09d6+08f3, delegates to loc_077f; 112 T", () => {
  const m = makeMachine();

  loc_0765(m);

  assert.equal(m.mem.read8(0x2093), 0x01, "(0x2093) := 0x01");
  assert.equal(m.regs.a, 0x01, "A := 0x01");
  assert.equal(m.regs.sp, 0x23fa, "SP: 0x2400 - three 2-byte pushes");
  assert.equal(m.regs.hl, 0x3013, "HL := 0x3013");
  assert.equal(m.regs.de, 0x1ff3, "DE := 0x1ff3");
  assert.equal(m.regs.c, 0x04, "C := 0x04");
  assert.equal(m.tstates, 7 + 13 + 10 + 4 + 17 + 17 + 10 + 10 + 7 + 17, "T total");
  assert.equal(m.pc, 0x08f3, "last step lands at the third callee");
  assert.deepEqual(m.calls, [0x1979, 0x09d6, 0x08f3, 0x077f], "three calls then delegate to loc_077f");
  assert.equal(m.io.inte, true, "ei enables interrupts (INTE set)");
  assert.deepEqual(
    m.pcSeq,
    [0x0767, 0x076a, 0x076d, 0x076e, 0x1979, 0x09d6, 0x0777, 0x077a, 0x077c, 0x08f3],
    "step boundaries",
  );
  assert.equal(m.mem.read16(0x23fe), 0x0771, "call 0x1979 pushes return addr 0x0771");
  assert.equal(m.mem.read16(0x23fc), 0x0774, "call 0x09d6 pushes return addr 0x0774");
  assert.equal(m.mem.read16(0x23fa), 0x077f, "call 0x08f3 pushes return addr 0x077f");
});

test("loc_0765 MUTATION: `sta 0x2093` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x076a ? 7 : c);
  loc_0765(m);
  assert.notEqual(m.tstates, 112, "golden T-state total catches the mutant");
});
