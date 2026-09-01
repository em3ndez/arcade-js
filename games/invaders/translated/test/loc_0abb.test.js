// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0abb (ROM 0x0abb-0x0abe): `pop h` discards the stacked return address
// into HL, then tail-delegates into 0x0072. Pins HL, the popped SP, T-states, and the target.
//
// Run: node --test games/invaders/translated/test/loc_0abb.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0abb } from "../loc_0abb.js";

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
    regs, mem, ram, calls: [], pushed: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushed.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0abb: pops the stacked word into HL, tail-delegates to 0x0072; 20 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(0x1234); // caller return address on the stack
  m.pushed = [];

  loc_0abb(m);

  assert.equal(m.regs.hl, 0x1234, "pop h took the stacked word");
  assert.equal(m.regs.sp, 0x2400, "SP advanced by the pop");
  assert.equal(m.tstates, 10 + 10, "pop(10)+jmp(10)");
  assert.equal(m.pc, 0x0072, "last step lands at the delegate target");
  assert.deepEqual(m.calls, [0x0072], "tail-delegates to loc_0072");
  assert.deepEqual(m.pcSeq, [0x0abc, 0x0072], "step boundaries");
});

test("loc_0abb MUTATION: `pop h` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(0x1234);
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x0abc ? 7 : c);
  loc_0abb(m);
  assert.equal(m.tstates, 7 + 10, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 20, "golden T-state total catches the mutant");
});
