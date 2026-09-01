// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_086d (ROM 0x086d-0x0871): A=0x01 then tail-jump to 0x079b.
// Run: node --test games/invaders/translated/test/loc_086d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_086d } from "../loc_086d.js";

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

test("loc_086d: A=0x01, tail-jump to 0x079b; 17 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_086d(m);

  assert.equal(m.regs.a, 0x01, "mvi a,0x01");
  assert.equal(m.tstates, 7 + 10, "T total");
  assert.deepEqual(m.calls, [0x079b], "tail-jump to 079b");
  assert.deepEqual(m.pcSeq, [0x086f, 0x079b], "step boundaries");
});

test("loc_086d MUTATION: mvi a mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x086f ? 4 : c);
  loc_086d(m);
  assert.notEqual(m.tstates, 17, "golden T-state total catches the mutant");
});
