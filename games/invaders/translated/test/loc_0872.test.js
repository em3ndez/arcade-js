// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0872 (ROM 0x0872-0x0877): call 0x021a then tail-jump into loc_0814.
// Run: node --test games/invaders/translated/test/loc_0872.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0872 } from "../loc_0872.js";

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

test("loc_0872: call 0x021a then tail-jump to loc_0814; 27 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_0872(m);

  assert.equal(m.tstates, 17 + 10, "T total");
  assert.deepEqual(m.calls, [0x021a, 0x0814], "call 021a then tail-jump 0814");
  assert.deepEqual(m.pcSeq, [0x021a, 0x0814], "step boundaries");
  assert.equal(m.mem.read16(0x23fe), 0x0875, "call 0x021a return addr");
});

test("loc_0872 MUTATION: call mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x021a ? 11 : c);
  loc_0872(m);
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
