// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_166d (ROM 0x166d-0x1670): zero A, call 0x1a8b, then fall through /
// delegate into loc_1671 (its own head). The mock records m.call targets rather than running
// them, so this pins the A write, the exact T-states, the call return address, and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_166d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_166d } from "../loc_166d.js";

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

test("loc_166d: xra a zeroes A, calls 0x1a8b, delegates to 0x1671; 21 T", () => {
  const m = makeMachine();
  m.regs.a = 0x55;
  m.regs.sp = 0x2400;

  loc_166d(m);

  assert.equal(m.regs.a, 0x00, "xra a := 0");
  assert.equal(m.regs.fZ, true, "xra a of zero sets Z");
  assert.equal(m.regs.fC, false, "xra clears carry");
  assert.equal(m.tstates, 4 + 17, "T total: xra(4)+call(17)");
  assert.equal(m.pc, 0x1a8b, "last step lands at the callee");
  assert.deepEqual(m.calls, [0x1a8b, 0x1671], "call 0x1a8b then delegate to loc_1671");
  assert.deepEqual(m.pcSeq, [0x166e, 0x1a8b], "step boundaries");
  assert.equal(m.mem.read16(0x23fe), 0x1671, "call 0x1a8b pushes return addr 0x1671");
});

test("loc_166d MUTATION: `call 0x1a8b` mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a8b ? 11 : c);
  loc_166d(m);
  assert.notEqual(m.tstates, 21, "golden T-state total catches the mutant (17 -> 11)");
});
