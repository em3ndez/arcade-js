// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for translated loc_3865 (ROM 0x3865-0x38a4, Pooyan) -- actor state handler
// with the backward wrapping-sum ROM-checksum tamper guard. Flat-RAM mock (real Regs); the
// mid-body `call 0x4006` is balanced (SP += 2) since the record-only stub does not run it.
//
// Pinned FULL path: timer (ix+0x11)=1 expires, IX=0x8b70 clears the position band, (0x8a5f)=0
// clears the gate, and a crafted 3-byte table (0x4282=0x02, 0x4281=0x05, 0x4280=0x1a) runs the
// checksum loop TWICE before the 0x1a terminator -- (E=0)+(C=0x07) & 0x9e = 0x06 != 0 -> the
// tamper counter at 0x8ef0 is bumped. Total T = 401 (independently hand-summed).
//
// Run: node --test games/pooyan/translated/test/loc_3865.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3865 } from "../loc_3865.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3865, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Balancing stub: the mid-body `call 0x4006` pushed its return; balance it (SP += 2).
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function setup(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = 0x8b70;
  m.mem.write8(0x8b81, 0x01); // (ix+0x11) timer -> dec to 0 (ret nz not taken)
  m.mem.write8(0x8b72, 0x00); // (ix+0x02) sub-state (incremented)
  m.mem.write8(0x8b78, 0xff); // (ix+0x08) -> res bit0 -> 0xfe
  m.mem.write8(0x8b74, 0x05); // (ix+0x04) -> dec -> 0x04
  m.mem.write8(0x8b76, 0x05); // (ix+0x06) -> dec -> 0x04
  m.mem.write8(0x8a5f, 0x00); // global gate clear
  m.mem.write8(0x4282, 0x02);
  m.mem.write8(0x4281, 0x05);
  m.mem.write8(0x4280, 0x1a); // terminator
}

const EXPECTED_PC_SEQ = [
  0x4006,
  0x386b, 0x386c, 0x386f, 0x3873, 0x3875, 0x3876, 0x3877, 0x3879, 0x387a, 0x387b, 0x387d, 0x387e,
  0x3881, 0x3884, 0x3887, 0x3888, 0x3889, 0x388c, 0x388e, 0x388f,
  0x3890, 0x3891, 0x3892, 0x3893, 0x3896, 0x3898, 0x3899, 0x388f, // iter1 (jr nz taken)
  0x3890, 0x3891, 0x3892, 0x3893, 0x3896, 0x3898, 0x3899, 0x389b, // iter2 (jr nz not taken)
  0x389c, 0x389d, 0x389f, 0x38a0, 0x38a3, 0x38a4,
  CALLER_RET,
];

test("loc_3865: full path -- timer expiry, checksum loop x2, tamper counter bumped; 401 T", () => {
  const m = makeMachine();
  setup(m);
  loc_3865(m);

  assert.equal(m.tstates, 401, "loc_3865 full-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via the final ret");
  assert.deepEqual(m.calls, [0x4006], "one mid-body call to the animation player");
  assert.equal(m.regs.sp, 0x8780, "call push balanced, ret popped the caller");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "full instruction-boundary sequence");

  const b = (a) => m.mem.read8(a);
  assert.equal(b(0x8b81), 0x00, "(ix+0x11) timer decremented to 0");
  assert.equal(b(0x8b72), 0x01, "(ix+0x02) sub-state incremented");
  assert.equal(b(0x8b78), 0xfe, "(ix+0x08) bit0 cleared");
  assert.equal(b(0x8b74), 0x04, "(ix+0x04) decremented");
  assert.equal(b(0x8b76), 0x04, "(ix+0x06) decremented");
  assert.equal(b(0x8ef0), 0x01, "tamper counter bumped");
  assert.equal(m.regs.c, 0x07, "C = running checksum sum");
  assert.equal(m.regs.a, 0x06, "A = (E + C) & 0x9e");

  const loopLandings = m.pcSeq.filter((p) => p === 0x3892).length;
  assert.equal(loopLandings, 2, "the `add a,c` loop body ran exactly twice");
});

test("loc_3865 MUTATION: `call 0x4006` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x4006 ? 10 : c);
  loc_3865(m);
  assert.equal(m.tstates, 394, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 401, "golden T-state total catches the mutant");
});

test("loc_3865 MUTATION: a dropped `add a,c` loop step (0 T) drops 2*4 = 8 T", () => {
  const m = makeMachine();
  setup(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3892 ? 0 : c); // the `add a,c` step landing
  loc_3865(m);
  assert.equal(m.tstates, 393, "two loop iterations each drop 4 T -> 8 T total");
});
