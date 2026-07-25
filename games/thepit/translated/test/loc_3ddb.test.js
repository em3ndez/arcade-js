// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_3ddb (ROM 0x3ddb-0x3e00), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake
// ROM (the copyrighted image is never committed). loc_3ddb calls nothing, so the
// asserted T-state total is entirely its OWN instruction cost.
//
// The routine fills a stride-0x20 column of B cells: the FIRST from (0x4b0f),
// the rest walked backwards through (ix). We seed the sources so every written
// byte is distinguishable, and pin (ix+0) with a POISON byte that the correct
// routine must never read (the `jr 0x3df7` skips the first (ix) load).
//
// MUTATION: model the `jr 0x3df7` as landing on loc_3df4 (do the (ix) load on
// the first pass too) -- the exact error of confusing loc_3ddb with its sibling
// loc_3dea. It corrupts the first written cell (poison 0xFF instead of the
// 0x4b0f cap) AND adds one 19 T (ix) read, so both the memory and the cycle
// assertions reject it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3ddb } from "../loc_3ddb.js";

// -- seeded inputs -------------------------------------------------------------
const COUNT = 4; // B = (0x8055): four cells down the column
const CAP = 0xc5; // (0x4b0f): the fixed FIRST-cell byte
const IX0 = 0x8140; // ix at entry (into work RAM)
const HL0 = 0x9000; // (0x8060): write cursor -> top of video RAM
const STRIDE = 0x20;
const POISON = 0xff; // planted at (ix+0)=IX0; the correct run must NOT read it
const SP0 = 0x8780; // initial SP (inside work RAM so the ret pop is mapped)
const SENTINEL = 0xbeef; // caller return address the `ret` must land on

// Source bytes walked backwards from IX0-1: reads happen at 0x813f/0x813e/0x813d
// (ix is decremented BEFORE the first read). IX0 itself is the poison byte.
const SRC = { 0x813f: 0xb1, 0x813e: 0xb2, 0x813d: 0xb3 };

function buildRom() {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  rom[0x4b0f] = CAP;
  return rom;
}

function seed(m) {
  m.mem.write8(0x8055, COUNT);
  m.mem.write16(0x8060, HL0);
  m.mem.write8(IX0, POISON);
  for (const [a, v] of Object.entries(SRC)) m.mem.write8(Number(a), v);
  m.regs.ix = IX0;
}

// Expected column in video RAM: cap, then the three backwards (ix) reads, each a
// STRIDE apart from HL0. (HL0 is the base of video RAM, so offsets are 0,20,40,60.)
const EXP_CELLS = [
  [HL0 - 0x9000, CAP],
  [HL0 - 0x9000 + 1 * STRIDE, SRC[0x813f]],
  [HL0 - 0x9000 + 2 * STRIDE, SRC[0x813e]],
  [HL0 - 0x9000 + 3 * STRIDE, SRC[0x813d]],
];

// -- T-state accounting (own cost only; nothing is called) --------------------
//   prologue: ld a,(nn)=13 + ld b,a=4 + ld hl,(nn)=16 + ld de,nn=10
//             + ld a,(nn)=13 + jr=12
const PROLOGUE = 13 + 4 + 16 + 10 + 13 + 12; // 68
//   per pass: ld (hl),a=7 + add hl,de=11 + dec ix=10 = 28
//   djnz: (COUNT-1) taken @13 + 1 not-taken @8 ; (ix) load: (COUNT-1) @19
const LOOP = 28 * COUNT + (COUNT - 1) * 13 + 8 + (COUNT - 1) * 19; // 216 @ COUNT=4
const EPILOGUE = 16 /*ld (nn),hl*/ + 10 /*ret*/; // 26
const EXP_CYCLES = PROLOGUE + LOOP + EPILOGUE; // 310 @ COUNT=4

// -- minimal machine: real mem/io/regs + the step/ret seam --------------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3ddb;
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
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

function run(fn) {
  const m = new TestMachine(buildRom());
  seed(m);
  // Push the caller's return address so `ret` has somewhere to land.
  m.regs.sp = (m.regs.sp - 2) & 0xffff;
  m.mem.write8(m.regs.sp, SENTINEL & 0xff);
  m.mem.write8((m.regs.sp + 1) & 0xffff, (SENTINEL >> 8) & 0xff);
  fn(m);
  return {
    cycles: m.cycles,
    video: m.mem.videoRam.slice(),
    cursor: m.mem.read16(0x8060),
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    de: m.regs.de,
    hl: m.regs.hl,
    ix: m.regs.ix,
    f: m.regs.f,
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");
  // The written column: cap first, then the three backwards (ix) reads.
  for (const [off, val] of EXP_CELLS) {
    assert.equal(res.video[off], val, `video cell @0x${(0x9000 + off).toString(16)}`);
  }
  // The poison at (ix+0)=IX0 must never appear -- proves the jr skipped loc_3df4.
  assert.equal(res.video[0], CAP, "first cell is the 0x4b0f cap, NOT (ix+0) poison");
  assert.equal(res.cursor, HL0 + COUNT * STRIDE, "0x8060 advanced by count*stride");
  assert.equal(res.hl, HL0 + COUNT * STRIDE, "HL past the column");
  assert.equal(res.ix, (IX0 - COUNT) & 0xffff, "ix decremented once per pass");
  assert.equal(res.b, 0x00, "B counted down to 0");
  assert.equal(res.a, SRC[0x813d], "A = last (ix) byte read");
  assert.equal(res.de, STRIDE, "DE holds the stride throughout");
  assert.equal(res.pc, SENTINEL, "ret lands on the caller");
  assert.equal(res.sp, SP0, "stack balanced");
  // Flags at ret are the last `add hl,de`'s: no carry/half (0x9060+0x20=0x9080),
  // S/Z/PV preserved from entry (Regs boots with Z set = 0x40) -> f == 0x40.
  assert.equal(res.f, 0x40, "flags = last add hl,de (Z preserved, C/H clear)");
}

test("loc_3ddb: cap + backwards (ix) column, cursor stored back; 310 T", () => {
  checkSpec(run(loc_3ddb));
});

// -- MUTATION: enter the loop at loc_3df4 (the loc_3dea entry) instead of
// loc_3df7, so the first pass ALSO does `ld a,(ix+0x00)`. The first cell becomes
// the poison byte (ix+0) and the run costs one extra 19 T read.
function loc_3ddb_mutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8055);
  m.step(0x3dde, 13);
  regs.b = regs.a;
  m.step(0x3ddf, 4);
  regs.hl = mem.read16(0x8060);
  m.step(0x3de2, 16);
  regs.de = 0x0020;
  m.step(0x3de5, 10);
  regs.a = mem.read8(0x4b0f);
  m.step(0x3de8, 13);
  // BUG: land on loc_3df4 and take the (ix) load before the first write.
  m.step(0x3df4, 12);
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3df7, 19);
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x3df8, 7);
    regs.addHl(regs.de);
    m.step(0x3df9, 11);
    regs.ix = (regs.ix - 1) & 0xffff;
    m.step(0x3dfb, 10);
    if (regs.djnz() !== 0) {
      m.step(0x3df4, 13);
      regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
      m.step(0x3df7, 19);
    } else {
      m.step(0x3dfd, 8);
      break;
    }
  }
  mem.write16(0x8060, regs.hl);
  m.step(0x3e00, 16);
  m.ret();
}

test("mutation (jr enters loc_3df4, first cell from (ix)) is caught", () => {
  const bad = run(loc_3ddb_mutant);
  // The poison leaked into the first cell -- a memory-visible corruption...
  assert.equal(bad.video[0], POISON, "mutant wrote the (ix+0) poison first");
  // ...and it cost one extra 19 T (ix) read.
  assert.equal(bad.cycles, EXP_CYCLES + 19, "mutant is exactly one (ix) read heavier");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
