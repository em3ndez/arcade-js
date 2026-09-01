// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_196b (ROM 0x196b-0x1970): call 0x19dc, then tail-delegate to loc_1671.
//
// Run: node --test games/invaders/translated/test/loc_196b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_196b } from "../loc_196b.js";

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

test("loc_196b: calls 0x19dc then delegates to loc_1671; 27 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_196b(m);

  assert.equal(m.tstates, 17 + 10, "T: call + jmp");
  assert.equal(m.pc, 0x1671, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x19dc, 0x1671], "call 0x19dc then delegate loc_1671");
  assert.equal(m.mem.read16(0x23fe), 0x196e, "call 0x19dc pushes return addr 0x196e");
  assert.deepEqual(m.pcSeq, [0x19dc, 0x1671], "step boundaries");
});

test("loc_196b MUTATION: call mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19dc ? 11 : c);
  loc_196b(m);
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
