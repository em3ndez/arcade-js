// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0141 (ROM 0x0141-0x0179): both guards pass, the slot scan runs one
// iteration (count byte 1 -> dcr b hits 0), no wrap (index 0x30 != 0x37 so cz 0x01a1 skipped),
// index >= 0x28 so jc 0x1971 not taken -> the fall-through latches D at 0x2004 and marks 0x2000.
// The record-only mock does not run loc_017a, so C keeps its seated value for `mov h,c`.
//
// Run: node --test games/invaders/translated/test/loc_0141.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0141 } from "../loc_0141.js";

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

function seatMain(m) {
  m.regs.sp = 0x2400;
  m.regs.c = 0x1c; // survives the record-only call to 0x017a; feeds `mov h,c`
  m.ram[0x2068] = 0x01; // != 0 -> rz not taken
  m.ram[0x2000] = 0x00; // == 0 -> rnz not taken
  m.ram[0x2067] = 0x20; // scan page (H)
  m.ram[0x2006] = 0x2f; // start index; inr -> 0x30
  m.ram[0x2030] = 0x01; // slot count 1 -> dcr b hits 0 after one pass
}

test("loc_0141: full scan, latches 0x2004/0x2000, updates 0x2006/0x200b; 253 T", () => {
  const m = makeMachine();
  seatMain(m);

  loc_0141(m);

  assert.equal(m.mem.read8(0x2006), 0x30, "0x2006 := new index 0x30");
  assert.equal(m.mem.read16(0x200b), 0x1c30, "0x200b := (C:L) = 0x1c30");
  assert.equal(m.mem.read8(0x2004), 0x02, "0x2004 := D (0x02)");
  assert.equal(m.mem.read8(0x2000), 0x01, "0x2000 := 0x01 (busy)");
  assert.equal(m.regs.a, 0x01, "A ends 0x01 (mvi a,0x01)");
  assert.equal(m.regs.hl, 0x1c30, "HL = C:L before shld");
  assert.equal(m.tstates, 253, "T total for guards-pass / one-iter / jc-not-taken path");
  assert.deepEqual(m.calls, [0x017a], "only the pointer-resolve call (no cz, no jc)");
  assert.equal(m.mem.read16(0x23fe), 0x0166, "call 0x017a pushes return 0x0166");
  assert.equal(m.pc, 0x0166, "record-only ret pops the internal call's return 0x0166");
});

test("loc_0141 GUARD arm: 0x2068 clear -> immediate rz", () => {
  const m = makeMachine();
  seatMain(m);
  m.ram[0x2068] = 0x00; // -> rz taken
  m.push16(0x4321); // caller return the rz pops

  loc_0141(m);

  assert.deepEqual(m.calls, [], "guard rets before any call");
  assert.equal(m.pc, 0x4321, "rz pops the caller return");
  assert.equal(m.tstates, 13 + 4 + 11, "lda+ana+rz(taken)");
});

test("loc_0141 MUTATION: rnz not-taken mis-charged 11T not 5T is caught", () => {
  const m = makeMachine();
  seatMain(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x014b ? 11 : c); // 0x014b = fall-through after rnz
  loc_0141(m);
  assert.notEqual(m.tstates, 253, "golden T-state total catches the mis-charged rnz fall-through");
});
