// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1770 (ROM 0x1770-0x1774): mask caller's A to 0x30, OUT port 5, ret.
// Pins the port write, masked A, T-states, and the ret to the caller.
//
// Run: node --test games/invaders/translated/test/loc_1770.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1770 } from "../loc_1770.js";

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
  const io = { out: [], portOut(port, v) { this.out.push([port, v & 0xff]); } };
  return {
    regs, mem, ram, io, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_1770: A &= 0x30, OUT 05, returns; 27 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xbd; // 0xbd & 0x30 == 0x30

  loc_1770(m);

  assert.equal(m.regs.a, 0x30, "A: 0xbd & 0x30");
  assert.deepEqual(m.io.out, [[0x05, 0x30]], "OUT 05 <- masked A");
  assert.equal(m.tstates, 7 + 10 + 10, "T: ani(7)+out(10)+ret(10)");
  assert.equal(m.pc, CALLER_RET, "final ret to caller");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x1772, 0x1774, CALLER_RET], "step boundaries");
});

test("loc_1770 MUTATION: mis-charged ani (10T not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xff;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1772 ? 10 : c);
  loc_1770(m);
  assert.notEqual(m.tstates, 27, "golden T-state total catches the mutant");
});
