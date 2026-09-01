// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_07f9 (ROM 0x07f9-0x0803): two init calls, xra a clears A + writes 0x20c1,
// then tail-delegates into loc_0804. Pins the calls, the cleared write, T-states, and push returns.
// Run: node --test games/invaders/translated/test/loc_07f9.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_07f9 } from "../loc_07f9.js";

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

test("loc_07f9: calls 088d+09d6, clears 0x20c1, delegates to loc_0804; 55 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.a = 0x55;

  loc_07f9(m);

  assert.equal(m.regs.a, 0x00, "xra a zeroes A");
  assert.equal(m.mem.read8(0x20c1), 0x00, "sta 0x20c1 writes the cleared A");
  assert.equal(m.tstates, 17 + 17 + 4 + 4 + 13, "T total");
  assert.deepEqual(m.calls, [0x088d, 0x09d6, 0x0804], "two calls then delegate to loc_0804");
  assert.deepEqual(m.pcSeq, [0x088d, 0x09d6, 0x0800, 0x0801, 0x0804], "step boundaries");
  assert.equal(m.mem.read16(0x23fe), 0x07fc, "call 0x088d return addr");
  assert.equal(m.mem.read16(0x23fc), 0x07ff, "call 0x09d6 return addr");
});

test("loc_07f9 MUTATION: sta mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0804 ? 7 : c);
  loc_07f9(m);
  assert.notEqual(m.tstates, 55, "golden T-state total catches the mutant");
});
