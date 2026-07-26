// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2bf2 (ROM 0x2bf2-0x2c01), The Pit.
//
// loc_2bf2 scans the 24-entry table at work RAM 0x80c3 for the first NON-zero entry
// (`ld a,(hl) / and a / jr nz`), stepping HL with a `djnz` count of 0x18:
//   - all entries zero -> store A(=0) to 0x80bd (clear the pending flag) and
//     TAIL-JUMP to 0x2f71.
//   - a non-zero entry found -> conditional TAIL-JUMP to loc_2c04 (the placement
//     path), leaving 0x80bd untouched, HL on the found entry and A = its value.
//
// Both exits are tail-jumps: loc_2bf2 pushed nothing, so the stubbed callee behaves
// as a bare `ret` (pop + no cycle charge), which both models 0x2f71 / loc_2c04
// returning to loc_2bf2's caller AND keeps the asserted T-state total = loc_2bf2's
// OWN cost. Two specs (all-zero path, found path) plus a deliberate mutation
// (the `jr nz` sense flipped to `jr z` -- "find the first ZERO") the specs must catch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2bf2 } from "../loc_2bf2.js";

const TABLE = 0x80c3; // 24-entry pending table
const PENDING = 0x80bd; // pending flag cleared on the all-zero exit
const TAIL_NONE = 0x2f71; // tail-jump target when nothing is pending
const TAIL_FOUND = 0x2c04; // tail-jump target when an entry is found
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret must land on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)
const PENDING_SEED = 0x5a; // pre-seed 0x80bd so "left untouched" is observable

// AddressSpace requires exactly a 20480-byte ROM; contents are irrelevant here
// (loc_2bf2 touches only work RAM), but it must exist.
function buildRom() {
  return new Uint8Array(0x5000);
}

// -- minimal machine: real mem/io/regs + the step/call seam ------------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2bf2;
    this.calls = [];
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed tail-callee: record the target, then behave as a bare `ret` (pop the
  // address on top of the stack). loc_2bf2 pushed nothing, so this pops the caller's
  // return address -- modelling 0x2f71 / loc_2c04 returning to loc_2bf2's caller.
  // No cycle charge: the callee's own cost is not loc_2bf2's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

// Fill the 24-entry table; `nonzeroAt` (or -1) marks the single non-zero entry.
function run(fn, nonzeroAt, nonzeroVal) {
  const rom = buildRom();
  const m = new TestMachine(rom);
  for (let i = 0; i < 0x18; i++) {
    m.mem.write8(TABLE + i, nonzeroAt === i ? nonzeroVal : 0x00);
  }
  m.mem.write8(PENDING, PENDING_SEED); // observe whether the routine clears it
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    pending: m.mem.read8(PENDING),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    hl: m.regs.hl,
  };
}

// -- all-zero path T-states --------------------------------------------------
//   prologue          : ld hl(10) + ld b(7)                       = 17
//   iters 1..23 (full): (ld a,(hl)7 + and a4 + jr nz nt7 + inc6 + djnz taken13)
//                       = 37 * 23                                 = 851
//   iter 24           : 7 + 4 + 7 + 6 + djnz not-taken 8          = 32
//   epilogue          : ld (0x80bd),a(13) + jp(10)                = 23
const EXPECT_T_NONE = 17 + 37 * 23 + 32 + 23; // 923

// -- found-at-index-3 path T-states ------------------------------------------
//   prologue          : 17
//   iters 1..3 (full) : 37 * 3                                    = 111
//   iter 4 (found)    : ld a,(hl)7 + and a4 + jr nz TAKEN 12      = 23
const FOUND_IDX = 3;
const FOUND_VAL = 0x42;
const EXPECT_T_FOUND = 17 + 37 * FOUND_IDX + 23; // 151

function checkNone(res) {
  assert.equal(res.cycles, EXPECT_T_NONE, "all-zero T-state total = 923");
  assert.equal(res.pending, 0x00, "0x80bd cleared to 0 (A was 0 at the store)");
  assert.deepEqual(res.calls, [TAIL_NONE], "tail-jumps to 0x2f71 exactly once");
  assert.equal(res.pc, SENTINEL, "0x2f71's ret returns to loc_2bf2's caller");
  assert.equal(res.sp, SP0, "stack balanced (no leaked push)");
  assert.equal(res.a, 0x00, "A = last (zero) entry read");
  assert.equal(res.b, 0x00, "B counted all the way down to 0");
  assert.equal(res.hl, (TABLE + 0x18) & 0xffff, "HL walked past all 24 entries (0x80db)");
}

function checkFound(res) {
  assert.equal(res.cycles, EXPECT_T_FOUND, "found-at-3 T-state total = 151");
  assert.equal(res.pending, PENDING_SEED, "0x80bd left UNTOUCHED on the found path");
  assert.deepEqual(res.calls, [TAIL_FOUND], "tail-jumps to loc_2c04 exactly once");
  assert.equal(res.pc, SENTINEL, "loc_2c04's ret returns to loc_2bf2's caller");
  assert.equal(res.sp, SP0, "stack balanced (no leaked push)");
  assert.equal(res.a, FOUND_VAL, "A holds the found entry's value");
  assert.equal(res.b, (0x18 - FOUND_IDX) & 0xff, "B decremented once per skipped entry (0x15)");
  assert.equal(res.hl, (TABLE + FOUND_IDX) & 0xffff, "HL points AT the found entry (0x80c6)");
}

test("loc_2bf2: all entries zero -> clears 0x80bd, tail-jumps to 0x2f71, 923 T", () => {
  checkNone(run(loc_2bf2, -1, 0));
});

test("loc_2bf2: non-zero entry at index 3 -> tail-jumps to loc_2c04, 0x80bd untouched, 151 T", () => {
  checkFound(run(loc_2bf2, FOUND_IDX, FOUND_VAL));
});

// -- MUTATION: flip the scan sense from `jr nz` (first NON-zero) to `jr z` (first
// ZERO). This is THE semantic of the routine. On the all-zero fixture the mutant
// diverts to loc_2c04 on entry 0 instead of scanning all 24 and clearing 0x80bd;
// on the found fixture it walks PAST the non-zero entry. Both specs must reject it.
function loc_2bf2_mutant(m) {
  const { regs, mem } = m;
  regs.hl = 0x80c3;
  m.step(0x2bf5, 10);
  regs.b = 0x18;
  m.step(0x2bf7, 7);
  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x2bf8, 7);
    regs.and(regs.a);
    m.step(0x2bf9, 4);
    if (regs.fZ) {
      // BUG: should be `jr nz` (branch on non-zero), not `jr z`.
      m.step(0x2c04, 12);
      return m.call(0x2c04);
    }
    m.step(0x2bfb, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2bfc, 6);
    if (regs.djnz() !== 0) {
      m.step(0x2bf7, 13);
      continue;
    }
    m.step(0x2bfe, 8);
    break;
  }
  mem.write8(0x80bd, regs.a);
  m.step(0x2c01, 13);
  m.step(0x2f71, 10);
  return m.call(0x2f71);
}

test("mutation (jr nz -> jr z) is caught by both specs", () => {
  // On the all-zero table the mutant jumps on the FIRST entry (Z set) -> wrong exit.
  const badNone = run(loc_2bf2_mutant, -1, 0);
  assert.deepEqual(badNone.calls, [TAIL_FOUND], "mutant diverts to loc_2c04 on entry 0");
  assert.equal(badNone.pending, PENDING_SEED, "mutant never clears 0x80bd");
  assert.throws(() => checkNone(badNone), "all-zero spec rejects the mutant");

  // On the found table the mutant skips the non-zero entry and clears 0x80bd instead.
  const badFound = run(loc_2bf2_mutant, FOUND_IDX, FOUND_VAL);
  assert.throws(() => checkFound(badFound), "found spec rejects the mutant");
});
