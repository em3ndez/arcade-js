// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0798 (ROM 0x0798-0x079a): B:=0x99 (BCD -1), xra a clears A (Z set),
// then fall through into loc_079b. Pins the register writes, the zero flag, T-states, delegate.
//
// Run: node --test games/invaders/translated/test/loc_0798.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0798 } from "../loc_0798.js";

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

test("loc_0798: B:=0x99, A:=0 (Z), delegates to loc_079b; 11 T", () => {
  const m = makeMachine();
  m.regs.a = 0x37; // arbitrary -> xra a must zero it

  loc_0798(m);

  assert.equal(m.regs.b, 0x99, "B := 0x99");
  assert.equal(m.regs.a, 0x00, "A := 0 (xra a)");
  assert.equal(m.regs.fZ, true, "xra a sets Z");
  assert.equal(m.regs.fC, false, "xra a clears carry");
  assert.equal(m.tstates, 7 + 4, "T total: mvi(7)+xra(4)");
  assert.equal(m.pc, 0x079b, "last step lands at loc_079b");
  assert.deepEqual(m.calls, [0x079b], "tail-delegates to loc_079b");
  assert.deepEqual(m.pcSeq, [0x079a, 0x079b], "step boundaries");
});

test("loc_0798 MUTATION: `xra a` mis-charged 7T (not 4T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x079b ? 7 : c);
  loc_0798(m);
  assert.equal(m.tstates, 7 + 7, "mutation adds 3 T (4 -> 7)");
  assert.notEqual(m.tstates, 11, "golden T-state total catches the mutant");
});
