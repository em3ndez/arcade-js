// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_585b (ROM 0x585b, Pooyan) -- the 16-bit sum-of-bytes ROM tripwire:
 * add B table bytes into A (carry bumps D), then A-=0xc1; only sum==0xc1 && D==0x1d early-returns,
 * every other outcome writes the tamper cell 0x882b=1. Pure leaf (no calls).
 *
 * Path OK: two no-carry bytes summing to 0xc1 with D pre-seeded 0x1d -> ret z at 0x586a. Path CARRY:
 * one byte overflows A so `jr nc` is not taken (inc d runs), sum != 0xc1 -> jr nz -> tamper write.
 * Path MISMATCH exercises jr nz taken with no carry. MUTATION: mis-charge `inc hl` (6T) as 4T.
 *
 * Run: node --test games/pooyan/translated/test/loc_585b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_585b } from "../loc_585b.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x585b, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_585b Path OK: sum==0xc1, D==0x1d -> ret z at 0x586a (checksum valid)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;
  m.regs.d = 0x1d;
  m.regs.b = 0x02;
  m.regs.hl = 0x0bb5;
  m.mem.write8(0x0bb5, 0x80);
  m.mem.write8(0x0bb6, 0x41); // 0x80 + 0x41 = 0xc1, no carries

  loc_585b(m);

  assert.equal(m.tstates, 115, "Path OK T-state total");
  assert.deepEqual(m.pcSeq, [
    0x585c, 0x585d, 0x5860, 0x5861, 0x585b, // iter1 no carry, djnz taken
    0x585c, 0x585d, 0x5860, 0x5861, 0x5863, // iter2 no carry, djnz falls out
    0x5865, 0x5867, 0x5869, 0x586a,         // sub, jr nz not taken, ld a,0x1d, cp d
    CALLER_RET,
  ], "no-carry sum, all-equal -> ret z");
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.equal(m.regs.a, 0x1d, "A = 0x1d (loaded for the cp d equality test)");
  assert.equal(m.regs.d, 0x1d, "D unchanged (no carries)");
  assert.equal(m.mem.read8(0x882b), 0x00, "tamper cell untouched");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_585b Path CARRY: byte overflows A -> inc d, mismatch -> tamper write", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x10;
  m.regs.d = 0x00;
  m.regs.b = 0x01;
  m.regs.hl = 0x0bb5;
  m.mem.write8(0x0bb5, 0xff); // 0x10 + 0xff = 0x10f -> A=0x0f, carry

  loc_585b(m);

  assert.equal(m.tstates, 85, "Path CARRY T-state total");
  assert.deepEqual(m.pcSeq, [
    0x585c, 0x585d, 0x585f, 0x5860, 0x5861, 0x5863, // carry -> inc d, djnz falls out
    0x5865, 0x586b, 0x586d, 0x5870,                 // sub, jr nz taken -> tamper write, ret
    CALLER_RET,
  ], "carry bumps D, sum != 0xc1 -> jr nz -> tamper");
  assert.equal(m.regs.a, 0x01, "A = 0x01 (tamper marker written last)");
  assert.equal(m.regs.d, 0x01, "D bumped by the carry");
  assert.equal(m.mem.read8(0x882b), 0x01, "tamper cell set");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_585b Path MISMATCH: no carry but sum != 0xc1 -> jr nz taken -> tamper", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;
  m.regs.d = 0x00;
  m.regs.b = 0x01;
  m.regs.hl = 0x0bb5;
  m.mem.write8(0x0bb5, 0x20); // sum 0x20, sub 0xc1 -> non-zero

  loc_585b(m);

  assert.deepEqual(m.pcSeq, [
    0x585c, 0x585d, 0x5860, 0x5861, 0x5863,
    0x5865, 0x586b, 0x586d, 0x5870,
    CALLER_RET,
  ], "no-carry, jr nz taken directly");
  assert.equal(m.mem.read8(0x882b), 0x01, "tamper cell set");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_585b MUTATION: `inc hl` mis-charged 4T (not 6T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5861 ? 4 : cycles);
  seatCaller(m);
  m.regs.a = 0x10;
  m.regs.d = 0x00;
  m.regs.b = 0x01;
  m.regs.hl = 0x0bb5;
  m.mem.write8(0x0bb5, 0xff);

  loc_585b(m);

  assert.equal(m.tstates, 83, "mutation loses 2 T (6 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 85, "Path CARRY T-state total"),
    /85/,
    "the 85-T golden must fail on the mutant",
  );
});
