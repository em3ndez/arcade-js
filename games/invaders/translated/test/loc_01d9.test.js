// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_01d9 (ROM 0x01d9-0x01e3): with HL just before a 4-byte record, load
// B:=[HL+1], then [HL+2]+=C and [HL+3]+=B. Seats a record at 0x2008 so both accumulates run,
// pinning the two stores, the register end-state, the RET pop, and 70 T. MUTATION flips a store.
//
// Run: node --test games/invaders/translated/test/loc_01d9.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_01d9 } from "../loc_01d9.js";

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

function seat() {
  const m = makeMachine();
  m.regs.hl = 0x2007;
  m.regs.c = 0x03;
  m.regs.sp = 0x2400;
  m.push16(0xd00d);           // caller return frame
  m.mem.write8(0x2008, 0x10); // -> B
  m.mem.write8(0x2009, 0x05); // += C
  m.mem.write8(0x200a, 0x20); // += B
  return m;
}

test("loc_01d9: B:=[HL+1], [HL+2]+=C, [HL+3]+=B, RET; 70 T", () => {
  const m = seat();

  loc_01d9(m);

  assert.equal(m.regs.b, 0x10, "B loaded from 0x2008");
  assert.equal(m.regs.a, 0x30, "A holds the last sum (0x10 + 0x20)");
  assert.equal(m.regs.hl, 0x200a, "HL walked to the last record byte");
  assert.equal(m.mem.read8(0x2009), 0x08, "0x2009 += C (0x05 + 0x03)");
  assert.equal(m.mem.read8(0x200a), 0x30, "0x200a += B (0x20 + 0x10)");
  assert.equal(m.pc, 0xd00d, "RET returns to the caller");
  assert.equal(m.regs.sp, 0x2400, "RET pops the pushed frame");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.tstates, 70, "5+7+5+5+7+7+5+5+7+7+10");
});

test("loc_01d9 MUTATION: a corrupted 0x200a store is caught by the golden value", () => {
  const m = seat();
  const realWrite = m.mem.write8;
  m.mem.write8 = (a, v) => realWrite(a, a === 0x200a ? (v ^ 0xff) : v);
  loc_01d9(m);
  assert.equal(m.mem.read8(0x200a), 0x30 ^ 0xff, "mutant stores the flipped byte");
  assert.notEqual(m.mem.read8(0x200a), 0x30, "golden mem assertion catches the mutant");
});
