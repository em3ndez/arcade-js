// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_183a (ROM 0x183a-0x1843): walk the BC script via 0x1856, draw
// each with 0x184c, loop until carry (end) -> ret. The mock `call` pops the pushed return (models
// the callee's ret) and flags carry on the 2nd 0x1856 so one draw runs then rc returns to caller.
// Run: node --test games/invaders/translated/test/loc_183a.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_183a } from "../loc_183a.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x183a, pcSeq: [], _n1856: 0, carryOn: 2,
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); if (addr === 0x1856 && ++this._n1856 >= this.carryOn) regs.fC = true; return undefined; },
  };
}

test("loc_183a: one draw pass then carry -> rc to caller; 77 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1dcf;

  loc_183a(m);

  assert.equal(m.regs.bc, 0x1dcf, "BC (script pointer) untouched by the walk");
  assert.equal(m.regs.sp, 0x2400, "stack balanced then unwound by rc");
  assert.equal(m.pc, CALLER_RET, "rc returns to the seated caller");
  assert.equal(m.tstates, 49 + 28, "pass1(call+rc-nt+call+jmp=49)+pass2(call+rc-taken=28)");
  assert.deepEqual(m.calls, [0x1856, 0x184c, 0x1856], "walk: fetch, draw, fetch(end)");
  assert.deepEqual(m.pcSeq, [0x1856, 0x183e, 0x184c, 0x183a, 0x1856, CALLER_RET], "step boundaries");
});

test("loc_183a MUTATION: `rc` not-taken mis-charged 11T (not 5T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1dcf;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x183e ? 11 : c);
  loc_183a(m);
  assert.equal(m.tstates, 77 + 6, "mutation adds 6 T (5 -> 11)");
  assert.notEqual(m.tstates, 77, "golden T-state total catches the mutant");
});
