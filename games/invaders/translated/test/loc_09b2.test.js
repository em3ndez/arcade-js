// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_09b2 (ROM 0x09b2-0x09c4): draw A as two hex digits. The mock's call is
// record-only but rebalances SP for the callee's ret, so the interleaved push psw/pop psw and
// push d/pop d restore correctly. Pins the two 0x09c5 calls, their return-addr pushes, the nibble
// split (A ends as the low nibble), DE preserved, and the exact T-states.
//
// Run: node --test games/invaders/translated/test/loc_09b2.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_09b2 } from "../loc_09b2.js";

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
    regs, mem, ram, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v & 0xffff); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; }, // record + rebalance
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); m.pushes.length = 0; }

test("loc_09b2: splits A=0x3c into nibbles, calls 0x09c5 twice, preserves DE; 116 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x3c;
  m.regs.de = 0xbeef;

  loc_09b2(m);

  assert.deepEqual(m.calls, [0x09c5, 0x09c5], "two glyph calls");
  assert.equal(m.regs.a, 0x0c, "A ends as the low nibble of 0x3c");
  assert.equal(m.regs.de, 0xbeef, "DE preserved across the routine");
  assert.equal(m.regs.sp, 0x2400, "SP balanced back to entry");
  assert.equal(m.pc, CALLER_RET, "final ret lands at the caller");
  assert.equal(m.tstates, 11 + 11 + 4 + 4 + 4 + 4 + 7 + 17 + 10 + 7 + 17 + 10 + 10, "116 T total");
  // pushes: DE, AF, then the two call return addrs (AF getter forces bit1=1)
  const af = (0x3c << 8) | 0x02; // flags 0 at entry -> (0&0xd5)|2
  assert.deepEqual(m.pushes, [0xbeef, af, 0x09bd, 0x09c3], "push sequence: DE, PSW, 2 call returns");
});

test("loc_09b2 MUTATION: `pop d` mis-charged 11T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x3c;
  m.regs.de = 0xbeef;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x09c4 ? 11 : c);
  loc_09b2(m);
  assert.notEqual(m.tstates, 116, "golden T-state total catches the mutant");
});
