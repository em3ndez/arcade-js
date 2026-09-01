// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_19dc (ROM 0x19dc-0x19e5): (0x2094) &= B, write-back + out port 3, ret.
// Run: node --test games/invaders/translated/test/loc_19dc.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_19dc } from "../loc_19dc.js";

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
    io: { outs: [], ins: {}, portIn(p) { return this.ins[p] & 0xff || 0; }, portOut(p, v) { this.outs.push([p, v & 0xff]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_19dc: (0x2094) &= B, out 0x03 <- result, ret; 50 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.mem.write8(0x2094, 0xc3);
  m.regs.b = 0x81; // 0xc3 & 0x81 = 0x81

  loc_19dc(m);

  assert.equal(m.mem.read8(0x2094), 0x81, "(0x2094) := old & B");
  assert.deepEqual(m.io.outs, [[0x03, 0x81]], "out port 3 <- masked value");
  assert.equal(m.regs.a, 0x81, "A holds the masked value");
  assert.equal(m.tstates, 13 + 4 + 13 + 10 + 10, "T total");
  assert.equal(m.pc, CALLER_RET, "ret pops the caller return addr");
  assert.equal(m.regs.sp, 0x2400, "SP restored after ret");
  assert.deepEqual(m.calls, [], "no delegations");
});

test("loc_19dc MUTATION: `out 0x03` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(CALLER_RET);
  m.mem.write8(0x2094, 0xc3);
  m.regs.b = 0x81;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x19e5 ? 7 : c);
  loc_19dc(m);
  assert.notEqual(m.tstates, 50, "golden T-state total catches the mutant");
});
