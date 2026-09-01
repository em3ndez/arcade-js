// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_190a (ROM 0x190a-0x190f): call 0x14d8, then tail-delegate to loc_1597.
//
// Run: node --test games/invaders/translated/test/loc_190a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_190a } from "../loc_190a.js";

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

test("loc_190a: calls 0x14d8 then delegates to loc_1597; 27 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_190a(m);

  assert.equal(m.tstates, 17 + 10, "T: call + jmp");
  assert.equal(m.pc, 0x1597, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x14d8, 0x1597], "call 0x14d8 then delegate loc_1597");
  assert.equal(m.mem.read16(0x23fe), 0x190d, "call 0x14d8 pushes return addr 0x190d");
  assert.deepEqual(m.pcSeq, [0x14d8, 0x1597], "step boundaries");
});

test("loc_190a MUTATION: call return addr pushed as 0x190a (self) not 0x190d is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realPush = m.push16.bind(m);
  m.push16 = (v) => realPush(v === 0x190d ? 0x190a : v);
  loc_190a(m);
  assert.notEqual(m.mem.read16(0x23fe), 0x190d, "the golden return-addr assertion catches the mutant");
});
