// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_176d (ROM 0x176d-0x1774): mask mem[0x2098] to its 0x30 sound bits and
// write to port 5, then ret. The stack is seeded with a sentinel return so the ret target is
// observable in the record-only mock.
//
// Run: node --test games/invaders/translated/test/loc_176d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_176d } from "../loc_176d.js";

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
    io: { outs: [], portOut(p, v) { this.outs.push([p, v & 0xff]); }, portIn() { return 0; } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_176d: masks mem[0x2098]&0x30 -> port 5, rets; 40 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x2400] = 0x00; m.ram[0x2401] = 0x08; // sentinel return 0x0800
  m.ram[0x2098] = 0x37; // & 0x30 -> 0x30 (drops the low 0x07)

  loc_176d(m);

  assert.equal(m.regs.a, 0x30, "A := mem[0x2098] & 0x30");
  assert.deepEqual(m.io.outs, [[0x05, 0x30]], "masked byte out to port 5");
  assert.equal(m.tstates, 13 + 7 + 10 + 10, "lda+ani+out+ret");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, 0x0800, "ret pops the sentinel return");
  assert.equal(m.regs.sp, 0x2402, "SP unwound past the popped return");
});

test("loc_176d MUTATION: ani 0x30 flipped to a wider mask is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x2098] = 0x37;
  const realAnd = Regs.prototype.and;
  m.regs.and = function (v) { return realAnd.call(this, v | 0x0f); }; // mask leaks the low nibble
  loc_176d(m);
  assert.notEqual(m.regs.a, 0x30, "golden masked value catches the widened mask");
  assert.equal(m.regs.a, 0x37, "the mutant leaves the low bits set");
});
