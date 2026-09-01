// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_079b (ROM 0x079b-0x07f8): BCD-adjusts the credit tally at 0x20eb by B
// (0x42 + 0x99, daa -> 0x41 = BCD -1), seeds the score/HUD RAM cells and the two per-player
// sprite records, runs 13 subroutine calls, then falls through into loc_07f9. Pins every memory
// write, the daa result, the full call sequence + return addresses, T-states, and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_079b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_079b } from "../loc_079b.js";

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

const CALLS = [
  0x1947, 0x1925, 0x192b, 0x19d7, 0x1956, 0x01ef, 0x01f5, 0x08d1,
  0x00d7, 0x01c0, 0x1904, 0x01e4, 0x1a7f, 0x07f9,
];

const T_TOTAL =
  13 + 13 + 4 + 4 + 13 + 17 + 10 + 16 + 16 + 17 + 17 + 17 + 10 + 5 + 13 + 16 +
  16 + 17 + 17 + 17 + 17 + 13 + 13 + 17 + 4 + 13 + 13 + 17 + 17 + 10 + 16 + 16 + 17 + 17;

test("loc_079b: BCD credit adjust, seeds RAM + sprite records, delegates to loc_07f9", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.a = 0x55; // stored at 0x20ce before it is reloaded
  m.regs.b = 0x99; // BCD -1 (as loc_0798 leaves it)
  m.mem.write8(0x20eb, 0x42); // credit tally

  loc_079b(m);

  // BCD tally: 0x42 + 0x99 = 0xdb, daa -> 0x41
  assert.equal(m.mem.read8(0x20ce), 0x55, "(0x20ce) := A on entry");
  assert.equal(m.mem.read8(0x20eb), 0x41, "credit tally BCD-decremented 0x42 -> 0x41");
  assert.equal(m.mem.read16(0x20f8), 0x0000, "shld 0x20f8 := 0x0000");
  assert.equal(m.mem.read16(0x20fc), 0x0000, "shld 0x20fc := 0x0000");
  assert.equal(m.mem.read8(0x20ef), 0x01, "(0x20ef) := H (0x01)");
  assert.equal(m.mem.read16(0x20e7), 0x0101, "shld 0x20e7 := 0x0101");
  assert.equal(m.mem.read16(0x20e5), 0x0101, "shld 0x20e5 := 0x0101");
  assert.equal(m.mem.read8(0x21ff), 0x01, "(0x21ff) := A (0x01)");
  assert.equal(m.mem.read8(0x22ff), 0x01, "(0x22ff) := A (0x01)");
  assert.equal(m.mem.read8(0x21fe), 0x00, "(0x21fe) := 0 (xra a)");
  assert.equal(m.mem.read8(0x22fe), 0x00, "(0x22fe) := 0 (xra a)");
  assert.equal(m.mem.read16(0x21fc), 0x3878, "shld 0x21fc := 0x3878");
  assert.equal(m.mem.read16(0x22fc), 0x3878, "shld 0x22fc := 0x3878");

  assert.equal(m.regs.a, 0x00, "A cleared by the last xra a");
  assert.equal(m.regs.b, 0x99, "B unchanged");
  assert.equal(m.regs.hl, 0x3878, "HL := 0x3878");

  assert.equal(m.tstates, T_TOTAL, "T-state total");
  assert.equal(m.pc, 0x1a7f, "last step lands at the final callee 0x1a7f");
  assert.deepEqual(m.calls, CALLS, "13 calls in order then delegate to loc_07f9");

  assert.equal(m.regs.sp, 0x23e6, "SP: 0x2400 - thirteen 2-byte pushes");
  assert.equal(m.mem.read16(0x23fe), 0x07a9, "first push (call 0x1947) return addr 0x07a9");
  assert.equal(m.mem.read16(0x23e6), 0x07f9, "last push (call 0x1a7f) return addr 0x07f9");
});

test("loc_079b MUTATION: `call 0x1a7f` mis-charged 11T (not 17T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.b = 0x99;
  m.mem.write8(0x20eb, 0x42);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a7f ? 11 : c);
  loc_079b(m);
  assert.notEqual(m.tstates, T_TOTAL, "golden T-state total catches the mutant");
});

test("loc_079b MUTATION: daa result flip (0x41 -> 0x42) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.b = 0x99;
  m.mem.write8(0x20eb, 0x42);
  loc_079b(m);
  assert.notEqual(m.mem.read8(0x20eb), 0x42, "the BCD-adjusted tally is not the pre-image");
});
