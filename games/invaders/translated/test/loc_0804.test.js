// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0804 (ROM 0x0804-0x0813): flag 0x2067 bit0 gates a delegate to loc_0872
// (taken) vs two calls + fall-through to loc_0814 (not taken). Both arms + a T-state mutation.
// Run: node --test games/invaders/translated/test/loc_0804.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0804 } from "../loc_0804.js";

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

test("loc_0804 bit0 clear: falls through to loc_0814; 78 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2067, 0x00);

  loc_0804(m);

  assert.equal(m.tstates, 17 + 13 + 4 + 10 + 17 + 17, "not-taken T total");
  assert.deepEqual(m.calls, [0x01cf, 0x0213, 0x01cf, 0x0814], "01cf, 0213, 01cf then delegate 0814");
  assert.deepEqual(m.pcSeq, [0x01cf, 0x080a, 0x080b, 0x080e, 0x0213, 0x01cf], "step boundaries");
  assert.equal(m.mem.read16(0x23fa), 0x0814, "call 0x01cf@0811 return addr");
});

test("loc_0804 bit0 set: delegates to loc_0872; 44 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2067, 0x01);

  loc_0804(m);

  assert.equal(m.tstates, 17 + 13 + 4 + 10, "taken T total");
  assert.deepEqual(m.calls, [0x01cf, 0x0872], "01cf then delegate 0872");
  assert.deepEqual(m.pcSeq, [0x01cf, 0x080a, 0x080b, 0x0872], "step boundaries");
});

test("loc_0804 MUTATION: lda mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2067, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x080a ? 7 : c);
  loc_0804(m);
  assert.notEqual(m.tstates, 78, "golden T-state total catches the mutant");
});
