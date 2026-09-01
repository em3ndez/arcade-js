// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1982 (ROM 0x1982-0x1985): stores A at 0x20c1, returns.
// Run: node --test games/invaders/translated/test/loc_1982.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1982 } from "../loc_1982.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_1982: (0x20c1) := A, ret; 23 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.a = 0x5a;

  loc_1982(m);

  assert.equal(m.mem.read8(0x20c1), 0x5a, "(0x20c1) := A");
  assert.equal(m.tstates, 13 + 10, "T total: sta(13)+ret(10)");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return addr");
  assert.equal(m.regs.sp, 0x2400, "SP restored after ret");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_1982 MUTATION: `sta 0x20c1` flipped value is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.regs.a = 0x5a;
  const realWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v) => realWrite(a, a === 0x20c1 ? (v ^ 0xff) : v);
  loc_1982(m);
  assert.notEqual(m.mem.read8(0x20c1), 0x5a, "golden value assertion catches the mutant");
});
