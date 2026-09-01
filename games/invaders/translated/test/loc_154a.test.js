// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_154a (ROM 0x154a-0x1552): clear prize-active flag 0x2002, load B=0xf7,
// tail-jump into loc_19dc (recorded as a delegate).
//
// Run: node --test games/invaders/translated/test/loc_154a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_154a } from "../loc_154a.js";

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

test("loc_154a: clears 0x2002, B := 0xf7, delegates into loc_19dc; 34 T", () => {
  const m = makeMachine();
  m.regs.a = 0xff;
  m.mem.write8(0x2002, 0x5a);

  loc_154a(m);

  assert.equal(m.regs.a, 0x00, "A := 0 (xra a)");
  assert.equal(m.mem.read8(0x2002), 0x00, "prize-active flag cleared");
  assert.equal(m.regs.b, 0xf7, "B := 0xf7");
  assert.equal(m.tstates, 4 + 13 + 7 + 10, "xra+sta+mvi+jmp");
  assert.deepEqual(m.calls, [0x19dc], "tail-delegates to loc_19dc");
  assert.equal(m.pc, 0x19dc, "last step lands at loc_19dc");
});

test("loc_154a MUTATION: `sta 0x2002` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x154e ? 7 : c); // sta lands at 0x154e
  loc_154a(m);
  assert.notEqual(m.tstates, 34, "golden T-state total catches the mutant");
});
