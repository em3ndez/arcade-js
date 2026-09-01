// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1856 (ROM 0x1856-0x1867): read a 4-byte record via BC. Two arms --
// (1) the 0xff terminator: STC then RZ returns with carry SET, BC untouched; (2) a real record:
// HL=(BC),(BC+1), DE=(BC+2),(BC+3), BC advanced by 4, ANA A clears carry, ret.
//
// Run: node --test games/invaders/translated/test/loc_1856.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1856 } from "../loc_1856.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1856, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_1856 TERMINATOR arm: (BC)=0xff -> stc+rz, carry SET, BC untouched; 29 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x2000;
  m.mem.write8(0x2000, 0xff);

  loc_1856(m);

  assert.equal(m.regs.a, 0xff, "A holds the terminator byte");
  assert.equal(m.regs.fC, true, "carry SET (stc) then rz taken");
  assert.equal(m.regs.bc, 0x2000, "BC untouched on the terminator arm");
  assert.equal(m.tstates, 7 + 7 + 4 + 11, "ldax+cpi+stc+rz(taken)");
  assert.equal(m.pc, CALLER_RET, "rz returns to caller");
  assert.deepEqual(m.pcSeq, [0x1857, 0x1859, 0x185a, CALLER_RET], "step boundaries");
});

test("loc_1856 RECORD arm: 4 bytes -> HL/DE, BC += 4, carry CLEAR; 98 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1dbe;
  m.mem.write8(0x1dbe, 0x40); // -> L
  m.mem.write8(0x1dbf, 0x20); // -> H
  m.mem.write8(0x1dc0, 0x10); // -> E
  m.mem.write8(0x1dc1, 0x08); // -> D

  loc_1856(m);

  assert.equal(m.regs.hl, 0x2040, "HL := (BC),(BC+1)");
  assert.equal(m.regs.de, 0x0810, "DE := (BC+2),(BC+3)");
  assert.equal(m.regs.a, 0x08, "A holds the last byte loaded (D)");
  assert.equal(m.regs.bc, 0x1dc2, "BC advanced by 4");
  assert.equal(m.regs.fC, false, "ana a clears carry (not a terminator)");
  assert.equal(m.tstates, 98, "full record read + ret");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
});

test("loc_1856 MUTATION: `ana a` mis-charged 7T (not 4T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x1dbe;
  m.mem.write8(0x1dbe, 0x40); m.mem.write8(0x1dbf, 0x20);
  m.mem.write8(0x1dc0, 0x10); m.mem.write8(0x1dc1, 0x08);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1867 ? 7 : c); // ana a -> step 0x1867, real 4T
  loc_1856(m);
  assert.equal(m.tstates, 101, "mutation adds 3 T (4 -> 7)");
  assert.notEqual(m.tstates, 98, "golden T-state total catches the mutant");
});
