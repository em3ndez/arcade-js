// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2c04 (ROM 0x2c04-0x2cb6), The Pit.
//
// loc_2c04 is the "spawn one item" path reached from loc_2bf2: it raises 0x80bd, seeds
// two record bytes, draws a random NON-empty slot from the 24-entry table at 0x80c3
// (call 0x4b1a = RNG, masked 0x1f, range-checked < 24, empty slots rejected), clears
// that slot, paints tile 0x25 into the tilemap cell the slot maps to, flags whether the
// new cell overlaps the tracked object at 0x8068/0x806b (0x8080 = 0/1), and TAIL-JUMPs
// to 0x2bd3.
//
// The call seam is stubbed: 0x4c97 and 0x4b1a are regular calls that pushed their own
// return address, so the stub behaves as a bare `ret` (pop + set pc) and, for 0x4b1a,
// hands back the next queued RNG byte in A -- which drives slot selection deterministically.
// The final `jp 0x2bd3` pushed nothing, so its stub pops the SENTINEL and the T-state
// total stays loc_2c04's OWN cost.
//
// Three path specs -- right-half slot (early skip, no overlap), right-half slot WITH
// overlap (d=1), and left-half slot whose paired right slot is empty (exercises the
// 0xfff4 back-up and the 0xb7 column) -- plus a deliberate mutation (the left/right
// column select `jr c` flipped) that the right-half spec must catch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2c04 } from "../loc_2c04.js";

const TABLE = 0x80c3; // 24-entry pending table
const RNG = 0x4b1a; // RNG leaf called for slot selection
const FX = 0x4c97; // leaf side-effect call
const TAIL = 0x2bd3; // tail-jump target
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret lands on
const SP0 = 0x8780; // SP inside work RAM so pushes/pops are mapped

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires a 20480-byte ROM; contents unused
}

// Minimal machine: real mem/io/regs + the step/call/push16 seam. The call stub records
// the target, models a bare `ret` (pop -> pc), and on the RNG address hands back the
// next queued random byte in A.
class TestMachine {
  constructor(rom, rngQueue) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2c04;
    this.calls = [];
    this.rngQueue = rngQueue.slice();
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
  call(addr) {
    this.calls.push(addr);
    if (addr === RNG) {
      if (this.rngQueue.length === 0) throw new Error("RNG queue exhausted");
      this.regs.a = this.rngQueue.shift() & 0xff;
    }
    this.pc = this.pop16(); // bare ret: pop the (just-pushed, or caller's) return address
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run({ table = {}, mem = {}, rng }) {
  const m = new TestMachine(buildRom(), rng);
  for (let i = 0; i < 0x18; i++) m.mem.write8(TABLE + i, table[i] ?? 0x00);
  for (const [addr, val] of Object.entries(mem)) m.mem.write8(Number(addr), val);
  m.push16(SENTINEL); // the caller's return address
  loc_2c04(m);
  // count tilemap cells painted with the tile code 0x25
  let tile25 = 0;
  let tile25Addr = -1;
  for (let a = 0x9000; a <= 0x93ff; a++) {
    if (m.mem.read8(a) === 0x25) {
      tile25++;
      tile25Addr = a;
    }
  }
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    d: m.regs.d,
    active: m.mem.read8(0x80bd),
    rec2: m.mem.read8(0x80aa),
    rec3: m.mem.read8(0x80ab),
    limit: m.mem.read8(0x80b1),
    rec1: m.mem.read8(0x80a9),
    col: m.mem.read8(0x80ac),
    overlap: m.mem.read8(0x8080),
    tile25,
    tile25Addr,
    mem: m.mem,
  };
}

// -- shared prologue T-states (2c04..2c19) -----------------------------------
//   ld a(7)+ld(13)+call(17)+ld a(7)+ld(13)+ld a(7)+ld(13)+ld a(13)+ld(13) = 103
const T_PROLOGUE = 103;
// -- one clean loop pass (in range, non-empty) 2c1c..break at 2c31 ------------
//   call(17)+and(7)+cp(7)+jrNC nt(7)+ld b(4)+ld e(4)+ld d(7)+ld hl(10)+add(11)
//   +ld a(hl)(7)+and(4)+jrZ nt(7) = 92
const T_LOOP1 = 92;
// -- loc_2c5b address computation 2c5b..2c90 (fixed instruction set) ----------
const T_ADDR = 236;
// -- loc_2cb0 epilogue 2cb0..2cb4 (ld a,d(4)+ld(13)+jp(10)) -------------------
const T_EPI = 27;

// ============================================================================
// SPEC 1: right-half slot (index 0x0f), no overlap. Early `jr nc,0x2c49` skip,
//   column = 0xbf, tile painted at 0x93d9, 0x8080 = 0.
// ============================================================================
//   post-loop 2c31..2c35: ld c(4)+ld a(4)+cp(7)+jrNC TAKEN(12)      = 27
//   loc_2c49 2c49..2c59 (jr c NOT taken -> ld a,0xbf):
//     ld a(7)+ld(hl)(7)+ld a(4)+add(7)+ld(13)+ld a(4)+cp(7)+ld a(7)+jrC nt(7)+ld a(7) = 70
//   loc_2c91 (jr nz taken): ld d(7)+ld a(13)+ld b(4)+ld a(13)+add(7)+cp(4)+jrNZ TAKEN(12) = 60
const T1 = T_PROLOGUE + T_LOOP1 + 27 + 70 + T_ADDR + 60 + T_EPI; // 615

function spec1(r) {
  assert.equal(r.cycles, T1, "spec1 T-state total = 615");
  assert.equal(r.active, 0x01, "0x80bd raised to 1");
  assert.equal(r.rec2, 0x10, "0x80aa seeded 0x10");
  assert.equal(r.rec3, 0x06, "0x80ab seeded 0x06");
  assert.equal(r.limit, 0x33, "0x80b1 copied from 0x80c2");
  assert.equal(r.rec1, 0x04, "0x80a9 = slot value(0x03) + 1");
  assert.equal(r.col, 0xbf, "0x80ac = 0xbf (right half, index >= 0x0c)");
  assert.equal(r.tile25, 1, "exactly one tilemap cell painted 0x25");
  assert.equal(r.tile25Addr, 0x93d9, "tile 0x25 painted at the computed cell 0x93d9");
  assert.equal(r.mem.read8(TABLE + 0x0f), 0x00, "chosen slot cleared");
  assert.equal(r.overlap, 0x00, "0x8080 = 0 (no overlap)");
  assert.equal(r.d, 0x00, "D = 0 on the no-overlap exit");
  assert.deepEqual(r.calls, [FX, RNG, TAIL], "calls 0x4c97, one RNG draw, tail-jump 0x2bd3");
  assert.equal(r.pc, SENTINEL, "0x2bd3's ret returns to loc_2c04's caller");
  assert.equal(r.sp, SP0, "stack balanced");
}

test("loc_2c04: right-half slot, no overlap -> tile at 0x93d9, 0x8080=0, 615 T", () => {
  spec1(
    run({
      table: { 0x0f: 0x03 },
      mem: { 0x80c2: 0x33, 0x806b: 0x00 }, // 0x806b != 0x80ac+0x0c -> no overlap
      rng: [0x0f],
    }),
  );
});

// ============================================================================
// SPEC 2: right-half slot (index 0x0f) WITH overlap -> d = 1. Same path as spec1
//   until loc_2c91, where 0x806b == 0x80ac+0x0c and 0x80a9 < 0x8068 <= 0x80a9+8.
// ============================================================================
//   loc_2c91 full body (all three jr's fall through):
//     ld d(7)+ld a(13)+ld b(4)+ld a(13)+add(7)+cp(4)+jrNZ nt(7)+ld a(13)+ld c(4)
//     +ld a(13)+cp(4)+jrNC nt(7)+add(7)+cp(4)+jrC nt(7)+ld d(7) = 121
const T2 = T_PROLOGUE + T_LOOP1 + 27 + 70 + T_ADDR + 121 + T_EPI; // 676

function spec2(r) {
  assert.equal(r.cycles, T2, "spec2 T-state total = 676");
  assert.equal(r.rec1, 0x11, "0x80a9 = slot value(0x10) + 1");
  assert.equal(r.col, 0xbf, "0x80ac = 0xbf (right half)");
  assert.equal(r.tile25, 1, "exactly one cell painted");
  assert.equal(r.tile25Addr, 0x9399, "tile 0x25 painted at 0x9399 for row 0x11");
  assert.equal(r.overlap, 0x01, "0x8080 = 1 (overlap detected)");
  assert.equal(r.d, 0x01, "D = 1 on the overlap exit");
  assert.equal(r.pc, SENTINEL, "tail-jump returns to caller");
  assert.equal(r.sp, SP0, "stack balanced");
}

test("loc_2c04: right-half slot with overlap -> 0x8080=1, 676 T", () => {
  spec2(
    run({
      table: { 0x0f: 0x10 },
      // 0x80ac becomes 0xbf; 0xbf+0x0c = 0xcb; 0x80a9 = 0x11; window (0x11, 0x19]
      mem: { 0x80c2: 0x33, 0x806b: 0xcb, 0x8068: 0x15 },
      rng: [0x0f],
    }),
  );
});

// ============================================================================
// SPEC 3: left-half slot (index 0x05) whose paired right slot (index 0x11) is EMPTY.
//   Exercises the middle block: `jr nz,0x2c44` NOT taken -> ld de,0xfff4; add hl,de;
//   jr 0x2c49, then the left column base 0xb7 (`jr c` taken). The originally-picked
//   left slot (0x80c8) is the one cleared; column = 0xb7; tile at 0x93d8.
// ============================================================================
//   post-loop 2c31..2c35: ld c(4)+ld a(4)+cp(7)+jrNC nt(7)                 = 22
//   middle 2c37..2c42 (jr nz NOT taken): ld e(7)+add(11)+ld a(hl)(7)+and(4)
//                       +jrNZ nt(7)+ld de(10)+add(11)+jr(12)               = 69
//   loc_2c49 2c49..2c57 (jr c TAKEN -> skip ld a,0xbf):
//     ld a(7)+ld(hl)(7)+ld a(4)+add(7)+ld(13)+ld a(4)+cp(7)+ld a(7)+jrC TAKEN(12) = 68
//   loc_2c91 (jr nz taken, no overlap): 60
const T3 = T_PROLOGUE + T_LOOP1 + 22 + 69 + 68 + T_ADDR + 60 + T_EPI; // 677

function spec3(r) {
  assert.equal(r.cycles, T3, "spec3 T-state total = 677");
  assert.equal(r.rec1, 0x03, "0x80a9 = left slot value(0x02) + 1 (pair empty, c kept)");
  assert.equal(r.col, 0xb7, "0x80ac = 0xb7 (left half, b stays 0x05)");
  assert.equal(r.tile25Addr, 0x93d8, "tile 0x25 painted at 0x93d8");
  assert.equal(r.mem.read8(TABLE + 0x05), 0x00, "the ORIGINAL left slot (0x80c8) was cleared");
  assert.equal(r.mem.read8(TABLE + 0x11), 0x00, "paired slot stays empty");
  assert.equal(r.overlap, 0x00, "0x8080 = 0");
  assert.deepEqual(r.calls, [FX, RNG, TAIL], "calls 0x4c97, one RNG draw, tail-jump");
  assert.equal(r.pc, SENTINEL, "tail-jump returns to caller");
}

test("loc_2c04: left-half slot, empty pair -> 0xfff4 back-up, column 0xb7, 677 T", () => {
  spec3(
    run({
      table: { 0x05: 0x02, 0x11: 0x00 },
      mem: { 0x80c2: 0x33, 0x806b: 0x00 },
      rng: [0x05],
    }),
  );
});

// -- RNG range/empty rejection: an out-of-range draw and an empty slot each force a redraw.
test("loc_2c04: RNG rejects >=24 and empty slots (extra loop passes cost 2 x 92 T)", () => {
  // 0x1f -> masks to 0x1f (>=0x18, out of range, redraw); 0x0f -> masks to 0x0f but that
  // slot is empty here... use index 0x1c(>=24) then index 0x0e(empty) then 0x0f(valid).
  const r = run({
    table: { 0x0f: 0x03 },
    mem: { 0x80c2: 0x33, 0x806b: 0x00 },
    rng: [0x1c, 0x0e, 0x0f],
  });
  // first draw 0x1c&0x1f=0x1c >= 0x18 -> jr nc taken (12) instead of the not-taken tail(7)
  //   of a clean pass; the reject pass costs call+and+cp+jrNC TAKEN = 17+7+7+12 = 43
  // second draw 0x0e&0x1f=0x0e < 0x18, slot empty -> full pass up to jr z TAKEN:
  //   17+7+7+7(nt)+4+4+7+10+11+7+4+12 = 97
  // third draw 0x0f -> clean pass (92). Total loop cost = 43 + 97 + 92 = 232.
  const T_LOOP_REJECTS = 43 + 97 + 92;
  const EXPECT = T_PROLOGUE + T_LOOP_REJECTS + 27 + 70 + T_ADDR + 60 + T_EPI;
  assert.equal(r.cycles, EXPECT, "two redraws add their loop-pass cost");
  assert.deepEqual(r.calls, [FX, RNG, RNG, RNG, TAIL], "three RNG draws before a valid slot");
  assert.equal(r.tile25Addr, 0x93d9, "still lands on index 0x0f's cell");
});

// ============================================================================
// MUTATION: flip the left/right column select `jr c,0x2c5b` (2c57) to `jr nc`.
// On spec1's right-half fixture (carry CLEAR at 2c53's cp) the real routine falls
// through to `ld a,0xbf` (col 0xbf, cell 0x93d9); the mutant instead jumps early with
// A = 0xb7 -> col 0xb7, a DIFFERENT cell, and skips the 7 T `ld a,0xbf`. spec1 rejects it.
// ============================================================================
function loc_2c04_mutant(m) {
  // Re-run the real routine up to the branch, then diverge. Rather than duplicate the
  // whole body, we run the genuine routine on a machine that patches memory: not possible
  // cleanly, so we hand-translate ONLY the differing instruction inside a full copy of the
  // path spec1 exercises (prologue -> one loop pass -> early skip -> loc_2c49 -> addr ->
  // no-overlap -> epilogue), with 2c57 as `jr nc`.
  const { regs, mem } = m;
  regs.a = 0x01; m.step(0x2c06, 7);
  mem.write8(0x80bd, regs.a); m.step(0x2c09, 13);
  m.push16(0x2c0c); m.step(0x4c97, 17); m.call(0x4c97);
  regs.a = 0x10; m.step(0x2c0e, 7);
  mem.write8(0x80aa, regs.a); m.step(0x2c11, 13);
  regs.a = 0x06; m.step(0x2c13, 7);
  mem.write8(0x80ab, regs.a); m.step(0x2c16, 13);
  regs.a = mem.read8(0x80c2); m.step(0x2c19, 13);
  mem.write8(0x80b1, regs.a); m.step(0x2c1c, 13);
  for (;;) {
    m.push16(0x2c1f); m.step(0x4b1a, 17); m.call(0x4b1a);
    regs.and(0x1f); m.step(0x2c21, 7);
    regs.cp(0x18); m.step(0x2c23, 7);
    if (regs.fNC) { m.step(0x2c1c, 12); continue; }
    m.step(0x2c25, 7);
    regs.b = regs.a; m.step(0x2c26, 4);
    regs.e = regs.a; m.step(0x2c27, 4);
    regs.d = 0x00; m.step(0x2c29, 7);
    regs.hl = 0x80c3; m.step(0x2c2c, 10);
    regs.addHl(regs.de); m.step(0x2c2d, 11);
    regs.a = mem.read8(regs.hl); m.step(0x2c2e, 7);
    regs.and(regs.a); m.step(0x2c2f, 4);
    if (regs.fZ) { m.step(0x2c1c, 12); continue; }
    m.step(0x2c31, 7);
    break;
  }
  regs.c = regs.a; m.step(0x2c32, 4);
  regs.a = regs.e; m.step(0x2c33, 4);
  regs.cp(0x0c); m.step(0x2c35, 7);
  if (regs.fNC) {
    m.step(0x2c49, 12);
  } else {
    m.step(0x2c37, 7);
    regs.e = 0x0c; m.step(0x2c39, 7);
    regs.addHl(regs.de); m.step(0x2c3a, 11);
    regs.a = mem.read8(regs.hl); m.step(0x2c3b, 7);
    regs.and(regs.a); m.step(0x2c3c, 4);
    if (regs.fNZ) {
      m.step(0x2c44, 12);
      regs.c = regs.a; m.step(0x2c45, 4);
      regs.a = regs.b; m.step(0x2c46, 4);
      regs.add(0x0c); m.step(0x2c48, 7);
      regs.b = regs.a; m.step(0x2c49, 4);
    } else {
      m.step(0x2c3e, 7);
      regs.de = 0xfff4; m.step(0x2c41, 10);
      regs.addHl(regs.de); m.step(0x2c42, 11);
      m.step(0x2c49, 12);
    }
  }
  regs.a = 0x00; m.step(0x2c4b, 7);
  mem.write8(regs.hl, regs.a); m.step(0x2c4c, 7);
  regs.a = regs.c; m.step(0x2c4d, 4);
  regs.add(0x01); m.step(0x2c4f, 7);
  mem.write8(0x80a9, regs.a); m.step(0x2c52, 13);
  regs.a = regs.b; m.step(0x2c53, 4);
  regs.cp(0x0c); m.step(0x2c55, 7);
  regs.a = 0xb7; m.step(0x2c57, 7);
  if (regs.fNC) { // BUG: real is `jr c` (branch on carry SET), mutant branches on clear
    m.step(0x2c5b, 12);
  } else {
    m.step(0x2c59, 7);
    regs.a = 0xbf; m.step(0x2c5b, 7);
  }
  mem.write8(0x80ac, regs.a); m.step(0x2c5e, 13);
  regs.a = mem.read8(0x80a9); m.step(0x2c61, 13);
  regs.a = regs.srl(regs.a); m.step(0x2c63, 8);
  regs.a = regs.srl(regs.a); m.step(0x2c65, 8);
  regs.a = regs.srl(regs.a); m.step(0x2c67, 8);
  regs.neg(); m.step(0x2c69, 8);
  regs.add(0x1f); m.step(0x2c6b, 7);
  regs.h = regs.a; m.step(0x2c6c, 4);
  regs.a = mem.read8(0x80ac); m.step(0x2c6f, 13);
  regs.a = regs.inc8(regs.a); m.step(0x2c70, 4);
  regs.e = regs.a; m.step(0x2c71, 4);
  regs.a = regs.srl(regs.a); m.step(0x2c73, 8);
  regs.a = regs.srl(regs.a); m.step(0x2c75, 8);
  regs.a = regs.srl(regs.a); m.step(0x2c77, 8);
  regs.c = regs.a; m.step(0x2c78, 4);
  regs.a = 0x00; m.step(0x2c7a, 7);
  regs.b = regs.a; m.step(0x2c7b, 4);
  regs.h = regs.srl(regs.h); m.step(0x2c7d, 8);
  regs.rra(); m.step(0x2c7e, 4);
  regs.h = regs.srl(regs.h); m.step(0x2c80, 8);
  regs.rra(); m.step(0x2c81, 4);
  regs.h = regs.srl(regs.h); m.step(0x2c83, 8);
  regs.rra(); m.step(0x2c84, 4);
  regs.l = regs.a; m.step(0x2c85, 4);
  regs.addHl(regs.bc); m.step(0x2c86, 11);
  regs.bc = 0x9000; m.step(0x2c89, 10);
  regs.addHl(regs.bc); m.step(0x2c8a, 11);
  regs.a = 0x25; m.step(0x2c8c, 7);
  regs.bc = 0xffe1; m.step(0x2c8f, 10);
  regs.addHl(regs.bc); m.step(0x2c90, 11);
  mem.write8(regs.hl, regs.a); m.step(0x2c91, 7);
  regs.d = 0x00; m.step(0x2c93, 7);
  regs.a = mem.read8(0x806b); m.step(0x2c96, 13);
  regs.b = regs.a; m.step(0x2c97, 4);
  regs.a = mem.read8(0x80ac); m.step(0x2c9a, 13);
  regs.add(0x0c); m.step(0x2c9c, 7);
  regs.cp(regs.b); m.step(0x2c9d, 4);
  if (regs.fNZ) {
    m.step(0x2cb0, 12);
  } else {
    m.step(0x2c9f, 7);
    regs.a = mem.read8(0x8068); m.step(0x2ca2, 13);
    regs.c = regs.a; m.step(0x2ca3, 4);
    regs.a = mem.read8(0x80a9); m.step(0x2ca6, 13);
    regs.cp(regs.c); m.step(0x2ca7, 4);
    if (regs.fNC) {
      m.step(0x2cb0, 12);
    } else {
      m.step(0x2ca9, 7);
      regs.add(0x08); m.step(0x2cab, 7);
      regs.cp(regs.c); m.step(0x2cac, 4);
      if (regs.fC) {
        m.step(0x2cb0, 12);
      } else {
        m.step(0x2cae, 7);
        regs.d = 0x01; m.step(0x2cb0, 7);
      }
    }
  }
  regs.a = regs.d; m.step(0x2cb1, 4);
  mem.write8(0x8080, regs.a); m.step(0x2cb4, 13);
  m.step(0x2bd3, 10);
  return m.call(0x2bd3);
}

test("mutation (jr c -> jr nc column select) is caught by spec1", () => {
  const m = new TestMachine(buildRom(), [0x0f]);
  for (let i = 0; i < 0x18; i++) m.mem.write8(TABLE + i, i === 0x0f ? 0x03 : 0x00);
  m.mem.write8(0x80c2, 0x33);
  m.mem.write8(0x806b, 0x00);
  m.push16(SENTINEL);
  loc_2c04_mutant(m);
  const bad = {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    d: m.regs.d,
    active: m.mem.read8(0x80bd),
    rec2: m.mem.read8(0x80aa),
    rec3: m.mem.read8(0x80ab),
    limit: m.mem.read8(0x80b1),
    rec1: m.mem.read8(0x80a9),
    col: m.mem.read8(0x80ac),
    overlap: m.mem.read8(0x8080),
    tile25: (() => {
      let n = 0;
      for (let a = 0x9000; a <= 0x93ff; a++) if (m.mem.read8(a) === 0x25) n++;
      return n;
    })(),
    tile25Addr: (() => {
      for (let a = 0x9000; a <= 0x93ff; a++) if (m.mem.read8(a) === 0x25) return a;
      return -1;
    })(),
    mem: m.mem,
  };
  // The mutant chose 0xb7 for a right-half slot: spec1 asserts 0x80ac == 0xbf.
  assert.equal(bad.col, 0xb7, "mutant picks the wrong (left) column base");
  assert.notEqual(bad.tile25Addr, 0x93d9, "mutant paints a different cell");
  assert.throws(() => spec1(bad), "spec1 rejects the column-select mutant");
});
