// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0814 (ROM 0x0814-0x081e): three calls (B=0x20 for the last), then
// fall-through into loc_081f. Pins the calls, B, T-states, and push returns.
// Run: node --test games/invaders/translated/test/loc_0814.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0814 } from "../loc_0814.js";

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

test("loc_0814: calls 00b1+19d1+18fa (B=0x20), delegates to loc_081f; 58 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_0814(m);

  assert.equal(m.regs.b, 0x20, "mvi b,0x20");
  assert.equal(m.tstates, 17 + 17 + 7 + 17, "T total");
  assert.deepEqual(m.calls, [0x00b1, 0x19d1, 0x18fa, 0x081f], "three calls then delegate 081f");
  assert.deepEqual(m.pcSeq, [0x00b1, 0x19d1, 0x081c, 0x18fa], "step boundaries");
  assert.equal(m.mem.read16(0x23fa), 0x081f, "call 0x18fa return addr");
});

test("loc_0814 MUTATION: mvi b mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x081c ? 4 : c);
  loc_0814(m);
  assert.notEqual(m.tstates, 58, "golden T-state total catches the mutant");
});
