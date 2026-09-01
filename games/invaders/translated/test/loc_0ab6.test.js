// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0ab6 (ROM 0x0ab6-0x0aba): A=0x80 then tail-delegate into 0x0ad7.
// Pins A, the T-states, and the delegate target (recorded, not run).
//
// Run: node --test games/invaders/translated/test/loc_0ab6.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0ab6 } from "../loc_0ab6.js";

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

test("loc_0ab6: A=0x80, tail-delegates to 0x0ad7; 17 T", () => {
  const m = makeMachine();

  loc_0ab6(m);

  assert.equal(m.regs.a, 0x80, "A := 0x80");
  assert.equal(m.tstates, 7 + 10, "mvi(7)+jmp(10)");
  assert.equal(m.pc, 0x0ad7, "last step lands at the delegate target");
  assert.deepEqual(m.calls, [0x0ad7], "tail-delegates to loc_0ad7");
  assert.deepEqual(m.pcSeq, [0x0ab8, 0x0ad7], "step boundaries");
});

test("loc_0ab6 MUTATION: `jmp 0x0ad7` mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  const rs = m.step.bind(m);
  m.step = (n, c) => rs(n, n === 0x0ad7 ? 4 : c);
  loc_0ab6(m);
  assert.equal(m.tstates, 7 + 4, "mutation loses 6 T (10 -> 4)");
  assert.notEqual(m.tstates, 17, "golden T-state total catches the mutant");
});
