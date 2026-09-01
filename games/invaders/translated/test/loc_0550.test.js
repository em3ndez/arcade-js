// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0550 (ROM 0x0550-0x055a): stash A at 0x207f, seat HL=0x2073 / B=0x0b,
// then tail-delegate to the shared row helper 0x1a32. Pins the store, the register seats, the exact
// T-states (MAME i8080), and the single delegate. `jmp` is NOT a call, so m.calls holds only 0x1a32.
//
// Run: node --test games/invaders/translated/test/loc_0550.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0550 } from "../loc_0550.js";

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

test("loc_0550: sta 0x207f, HL=0x2073, B=0x0b, delegates to 0x1a32; 40 T", () => {
  const m = makeMachine();
  m.regs.a = 0x5a;

  loc_0550(m);

  assert.equal(m.mem.read8(0x207f), 0x5a, "sta 0x207f stores A");
  assert.equal(m.regs.hl, 0x2073, "HL := 0x2073");
  assert.equal(m.regs.b, 0x0b, "B := 0x0b");
  assert.equal(m.tstates, 13 + 10 + 7 + 10, "T: sta(13)+lxi(10)+mvi(7)+jmp(10)");
  assert.equal(m.pc, 0x1a32, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x1a32], "single tail-delegate; jmp is not a push");
});

test("loc_0550 MUTATION: `sta 0x207f` mis-charged 10T not 13T is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0553 ? 10 : c);
  loc_0550(m);
  assert.notEqual(m.tstates, 40, "golden T-state total catches the mutant");
});
