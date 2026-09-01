// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0072 (ROM 0x0072-0x0081): latches 0x2032 -> 0x2080, runs the three
// per-frame subroutines, nop, then falls through into the shared epilogue loc_0082. Pins the
// memory latch, the three call return addresses, the delegate, and the exact T-states.
//
// Run: node --test games/invaders/translated/test/loc_0072.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0072 } from "../loc_0072.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], ports: {},
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
  m.io = { portIn: (p) => m.ports[p] ?? 0, portOut: (p, v) => { m.ports[p] = v & 0xff; } };
  return m;
}

test("loc_0072: latches 0x2032->0x2080, calls 0100/0248/0913, delegates to loc_0082; 81 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2032, 0x5a);

  loc_0072(m);

  assert.equal(m.regs.a, 0x5a, "A := (0x2032)");
  assert.equal(m.mem.read8(0x2080), 0x5a, "0x2080 := (0x2032)");
  assert.equal(m.regs.sp, 0x23fa, "SP: 0x2400 - three call pushes");
  assert.equal(m.pc, 0x0082, "last step (nop) lands at 0x0082");
  assert.equal(m.tstates, 13 + 13 + 17 + 17 + 17 + 4, "T total: lda+sta+3xcall+nop");
  assert.deepEqual(m.calls, [0x0100, 0x0248, 0x0913, 0x0082], "3 calls then delegate to loc_0082");
  assert.equal(m.mem.read16(0x23fe), 0x007b, "call 0x0100 return addr");
  assert.equal(m.mem.read16(0x23fc), 0x007e, "call 0x0248 return addr");
  assert.equal(m.mem.read16(0x23fa), 0x0081, "call 0x0913 return addr");
});

test("loc_0072 MUTATION: `nop` mis-charged 0T not 4T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0082 ? 0 : c);
  loc_0072(m);
  assert.notEqual(m.tstates, 81, "golden T-state total catches the mutant");
});
