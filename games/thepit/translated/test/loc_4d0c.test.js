// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4d0c (ROM 0x4d0c-0x4d39), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. loc_4d0c reads the
// 16-bit value staged at 0x8037 (low) / 0x8038 (high) and unpacks it into four
// nibble "digit" cells at the buffer HL points to, plus two trailing zeros. The
// KEY behaviour under test is the LEADING-ZERO SUPPRESSION: when the top nibble
// (hi>>4) is zero, the first store + its inc hl are skipped, so only FIVE bytes
// are written and HL lands one cell earlier -- which also makes the taken `jr z`
// (12 T) vs not-taken (7 T + ld (hl),a 7 T + inc hl 6 T) a 8-T cycle difference
// between the two paths (215 T emit vs 207 T blank). A deliberate mutation (the
// leading-zero skip removed) is asserted to be caught by both the byte pattern
// and the T-state total.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs, F_Z } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4d0c } from "../loc_4d0c.js";

const SENTINEL = 0xbeef; // return address the routine's `ret` must land on
const BUF = 0x8286; // display buffer HL points to (work RAM, clear of 0x8037/0x8038)

class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x4d0c;
    this.regs.sp = 0x8780; // inside work RAM so the pushed return is mapped
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
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

// Run `fn` with hi @0x8038, lo @0x8037, HL = BUF, six pre-dirtied 0xEE cells.
function run(fn, hi, lo) {
  const m = new TestMachine();
  m.mem.write8(0x8038, hi);
  m.mem.write8(0x8037, lo);
  for (let i = 0; i < 8; i++) m.mem.write8(BUF + i, 0xee); // pre-dirty to catch stray writes
  m.regs.hl = BUF;
  m.push16(SENTINEL);
  fn(m);
  return {
    cycles: m.cycles,
    out: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => m.mem.read8(BUF + i)),
    hl: m.regs.hl,
    pc: m.pc,
    sp: m.regs.sp,
    fZ: (m.regs.f & F_Z) !== 0,
  };
}

// -- PATH A: top nibble non-zero -> all six cells written --------------------
// hi=0x12, lo=0x34  ->  1,2,3,4,0,0 ; HL = BUF+5 (last store has no inc) ; 215 T
function checkPathA(res) {
  assert.equal(res.cycles, 215, "path A T-state total (leading digit emitted)");
  assert.deepEqual(
    res.out,
    [0x1, 0x2, 0x3, 0x4, 0x00, 0x00, 0xee, 0xee],
    "path A: four nibbles 1,2,3,4 then two blanks",
  );
  assert.equal(res.hl, BUF + 5, "path A: HL at the last cell (final ld (hl),0 has no inc)");
  assert.equal(res.pc, SENTINEL, "ret returns to caller");
  assert.equal(res.sp, 0x8780, "stack balanced");
  assert.equal(res.fZ, false, "final and 0x0f (lo nibble = 4) leaves Z clear");
}

// -- PATH B: top nibble zero -> leading digit blanked, five cells written ----
// hi=0x08, lo=0x9a  ->  8,9,A,0,0 ; HL = BUF+4 (one fewer inc) ; 207 T
function checkPathB(res) {
  assert.equal(res.cycles, 207, "path B T-state total (leading digit blanked)");
  assert.deepEqual(
    res.out,
    [0x8, 0x9, 0xa, 0x00, 0x00, 0xee, 0xee, 0xee],
    "path B: leading zero suppressed, run shifted down one cell",
  );
  assert.equal(res.hl, BUF + 4, "path B: HL one cell earlier than path A (skipped inc)");
  assert.equal(res.pc, SENTINEL, "ret returns to caller");
  assert.equal(res.sp, 0x8780, "stack balanced");
}

test("loc_4d0c: unpacks value at 0x8037/0x8038 into nibble digit cells", () => {
  checkPathA(run(loc_4d0c, 0x12, 0x34));
  checkPathB(run(loc_4d0c, 0x08, 0x9a));
});

// -- MUTATION: the leading-zero suppression removed (always emit the top digit).
// For path-B input the mutant writes SIX cells (0,8,9,A,0,0) with HL = BUF+6 and
// costs 215 T instead of 207 -- so BOTH the byte pattern and the T-state total
// must reject it. (Path A is unaffected, exactly the point of the branch.)
function loc_4d0c_mut(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8038);
  m.step(0x4d0f, 13);
  regs.c = regs.a;
  m.step(0x4d10, 4);
  regs.a = regs.srl(regs.a);
  m.step(0x4d12, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x4d14, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x4d16, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x4d18, 8);
  // BUG: skip removed -- always emit the top digit (7 + 7 + 6 T), never blanked.
  m.step(0x4d1a, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x4d1b, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d1c, 6);
  regs.a = regs.c;
  m.step(0x4d1d, 4);
  regs.and(0x0f);
  m.step(0x4d1f, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x4d20, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d21, 6);
  regs.a = mem.read8(0x8037);
  m.step(0x4d24, 13);
  regs.c = regs.a;
  m.step(0x4d25, 4);
  regs.a = regs.srl(regs.a);
  m.step(0x4d27, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x4d29, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x4d2b, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x4d2d, 8);
  mem.write8(regs.hl, regs.a);
  m.step(0x4d2e, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d2f, 6);
  regs.a = regs.c;
  m.step(0x4d30, 4);
  regs.and(0x0f);
  m.step(0x4d32, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x4d33, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d34, 6);
  mem.write8(regs.hl, 0x00);
  m.step(0x4d36, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4d37, 6);
  mem.write8(regs.hl, 0x00);
  m.step(0x4d39, 10);
  m.ret();
}

test("mutation (leading-zero suppression removed) is caught", () => {
  const bad = run(loc_4d0c_mut, 0x08, 0x9a);
  // Sanity: the mutant really does diverge (writes 6 cells, 215 T).
  assert.deepEqual(bad.out, [0x0, 0x8, 0x9, 0xa, 0x00, 0x00, 0xee, 0xee], "mutant emits the zero top digit");
  assert.equal(bad.cycles, 215, "mutant is 8 T heavier than the blanked path");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkPathB(bad), /path B/);
});
