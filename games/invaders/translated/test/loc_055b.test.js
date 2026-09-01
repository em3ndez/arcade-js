// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_055b (ROM 0x055b-0x0562): tail-jump entry that seats DE=0x2073 / B=0x0b
// and delegates to the shared row helper 0x1a32. Pins the register seats, the exact T-states, and
// the single delegate (jmp is not a call, so no push16).
//
// Run: node --test games/invaders/translated/test/loc_055b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_055b } from "../loc_055b.js";

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

test("loc_055b: DE=0x2073, B=0x0b, delegates to 0x1a32; 27 T", () => {
  const m = makeMachine();

  loc_055b(m);

  assert.equal(m.regs.de, 0x2073, "DE := 0x2073");
  assert.equal(m.regs.b, 0x0b, "B := 0x0b");
  assert.equal(m.tstates, 10 + 7 + 10, "T: lxi(10)+mvi(7)+jmp(10)");
  assert.equal(m.pc, 0x1a32, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x1a32], "single tail-delegate; jmp is not a push");
});

test("loc_055b MUTATION: B mis-loaded 0x0a not 0x0b is caught", () => {
  const m = makeMachine();
  loc_055b(m);
  assert.notEqual(m.regs.b, 0x0a, "golden B seat catches a value mutant");
  assert.equal(m.regs.b, 0x0b);
});
