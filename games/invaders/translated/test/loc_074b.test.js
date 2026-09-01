// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_074b (ROM 0x074b-0x075e): ORs bit4 into 0x2098, calls 0x1770, resets
// the sprite pointer at 0x2087 to 0x1d7c, tail-jumps into loc_073c.
// Run: node --test games/invaders/translated/test/loc_074b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_074b } from "../loc_074b.js";

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

test("loc_074b: sets bit4 at 0x2098, calls 0x1770, resets 0x2087, delegates to 0x073c; 88 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2098, 0x03);

  loc_074b(m);

  assert.equal(m.regs.b, 0x10, "B := 0x10");
  assert.equal(m.regs.a, 0x13, "A := 0x03 | 0x10");
  assert.equal(m.regs.hl, 0x1d7c, "HL := 0x1d7c");
  assert.equal(m.mem.read8(0x2098), 0x13, "0x2098 gets bit4 set");
  assert.equal(m.mem.read16(0x2087), 0x1d7c, "sprite pointer 0x2087 reset to 0x1d7c");
  assert.equal(m.tstates, 7 + 10 + 7 + 4 + 7 + 17 + 10 + 16 + 10, "T total");
  assert.equal(m.pc, 0x073c, "last step lands at the delegate");
  assert.deepEqual(m.calls, [0x1770, 0x073c], "call 0x1770 then tail-jmp 0x073c");
  assert.equal(m.mem.read16(0x23fe), 0x0756, "call 0x1770 pushes return 0x0756");
});

test("loc_074b MUTATION: call 0x1770 mischarged 11T not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2098, 0x03);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1770 ? 11 : c);
  loc_074b(m);
  assert.equal(m.tstates, 7 + 10 + 7 + 4 + 7 + 11 + 10 + 16 + 10, "mutation loses 6 T");
  assert.notEqual(m.tstates, 88, "golden T-state total catches the mutant");
});
