// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_1837 (ROM 0x1837-0x1839): point BC at the 0x1dcf script, fall
// through into loc_183a. Golden delegate + a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_1837.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1837 } from "../loc_1837.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1837, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1837: BC := 0x1dcf, delegates to loc_183a; 10 T", () => {
  const m = makeMachine();

  loc_1837(m);

  assert.equal(m.regs.bc, 0x1dcf, "lxi b,0x1dcf");
  assert.equal(m.tstates, 10, "lxi b is 10 T");
  assert.deepEqual(m.calls, [0x183a], "fall-through delegate to loc_183a");
  assert.deepEqual(m.pcSeq, [0x183a], "step boundary");
});

test("loc_1837 MUTATION: `lxi b` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x183a ? 7 : c);
  loc_1837(m);
  assert.equal(m.tstates, 7, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 10, "golden T-state total catches the mutant");
});
