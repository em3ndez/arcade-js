// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4d3a (ROM 0x4d3a-0x4df7), The Pit.
//
// loc_4d3a inserts a candidate 16-bit value (D = high @0x8034, E = low @0x8031)
// into the descending three-entry high-score table:
//   rank 1 (top): value @0x803c, initials @0x8039..0x803b
//   rank 2      : value @0x8041, initials @0x803e..0x8040
//   rank 3 (low): value @0x8046, initials @0x8043..0x8045
// 0x8048 records which rank (1/2/3) the value landed at. Lower entries (value AND
// their 3-byte initials) shift DOWN one rank as the candidate climbs; the freed
// slot's initials are stamped 0xFF. A value that does not beat rank 3 returns
// with the table untouched.
//
// The cases below exercise every exit: no-placement via `ret c` (A) and `ret z`
// (B); landing at rank 3 (C), rank 2 with a one-rank shift (D), and rank 1 with
// the full cascade (E); plus a low-byte tie-break that decides rank 2 (F). The
// MUTATION deletes the `ld (0x8041),hl` push-down in the rank-1 cascade, which
// both corrupts the rank-2 value AND drops 16 T -- both the memory and the
// T-state assertions must reject it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4d3a } from "../loc_4d3a.js";

const SENTINEL = 0xbeef; // return address the routine's `ret` must land on

// Rank slot value + initials-field addresses.
const V1 = 0x803c, INI1 = 0x8039;
const V2 = 0x8041, INI2 = 0x803e;
const V3 = 0x8046, INI3 = 0x8043;
const MARK = 0x8048; // landed-rank marker (caller pre-clears to 0)

class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x4d3a;
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

function writeInitials(m, base, [a, b, c]) {
  m.mem.write8(base, a);
  m.mem.write8(base + 1, b);
  m.mem.write8(base + 2, c);
}
function readInitials(m, base) {
  return [m.mem.read8(base), m.mem.read8(base + 1), m.mem.read8(base + 2)];
}

// Default descending table: rank1=0x5000, rank2=0x3000, rank3=0x1000, with
// distinct initials so a shift-down is visible.
const DEF = {
  v1: 0x5000, v2: 0x3000, v3: 0x1000,
  ini1: [0xa1, 0xa2, 0xa3],
  ini2: [0xb1, 0xb2, 0xb3],
  ini3: [0xc1, 0xc2, 0xc3],
};

// Build the table + candidate, run `fn`, snapshot the whole table.
function run(fn, cand, table = DEF) {
  const m = new TestMachine();
  m.mem.write16(V1, table.v1);
  m.mem.write16(V2, table.v2);
  m.mem.write16(V3, table.v3);
  writeInitials(m, INI1, table.ini1);
  writeInitials(m, INI2, table.ini2);
  writeInitials(m, INI3, table.ini3);
  m.mem.write8(0x8031, cand & 0xff); // E = low byte
  m.mem.write8(0x8034, (cand >> 8) & 0xff); // D = high byte
  m.mem.write8(MARK, 0x00); // caller pre-clears the landed-rank marker
  m.push16(SENTINEL);
  fn(m);
  return {
    cycles: m.cycles,
    v1: m.mem.read16(V1), v2: m.mem.read16(V2), v3: m.mem.read16(V3),
    ini1: readInitials(m, INI1),
    ini2: readInitials(m, INI2),
    ini3: readInitials(m, INI3),
    mark: m.mem.read8(MARK),
    pc: m.pc,
    sp: m.regs.sp,
  };
}

// -- Case A: below rank 3 -> no placement (ret c) ----------------------------
test("loc_4d3a A: candidate below rank 3 leaves the table untouched (ret c)", () => {
  const r = run(loc_4d3a, 0x0800);
  assert.equal(r.cycles, 65, "ret c taken after one compare");
  assert.equal(r.v1, 0x5000);
  assert.equal(r.v2, 0x3000);
  assert.equal(r.v3, 0x1000, "rank 3 unchanged");
  assert.deepEqual(r.ini1, [0xa1, 0xa2, 0xa3]);
  assert.deepEqual(r.ini2, [0xb1, 0xb2, 0xb3]);
  assert.deepEqual(r.ini3, [0xc1, 0xc2, 0xc3], "no initials touched");
  assert.equal(r.mark, 0x00, "landed-rank marker stays 0");
  assert.equal(r.pc, SENTINEL, "ret returns to caller");
  assert.equal(r.sp, 0x8780, "stack balanced");
});

// -- Case B: exactly equal to rank 3 -> no placement (ret z) ------------------
test("loc_4d3a B: candidate equal to rank 3 leaves the table untouched (ret z)", () => {
  const r = run(loc_4d3a, 0x1000);
  assert.equal(r.cycles, 90, "high tie then low tie -> ret z");
  assert.equal(r.v3, 0x1000, "rank 3 unchanged");
  assert.equal(r.mark, 0x00, "landed-rank marker stays 0");
  assert.equal(r.pc, SENTINEL);
  assert.equal(r.sp, 0x8780, "stack balanced");
});

// -- Case C: between rank 3 and rank 2 -> lands at rank 3 ---------------------
test("loc_4d3a C: candidate above rank 3 but below rank 2 lands at rank 3", () => {
  const r = run(loc_4d3a, 0x2000);
  assert.equal(r.cycles, 242);
  assert.equal(r.v1, 0x5000, "rank 1 untouched");
  assert.equal(r.v2, 0x3000, "rank 2 untouched");
  assert.equal(r.v3, 0x2000, "candidate now at rank 3");
  assert.deepEqual(r.ini3, [0xff, 0xff, 0xff], "rank-3 initials stamped 0xff");
  assert.deepEqual(r.ini2, [0xb1, 0xb2, 0xb3], "rank-2 initials untouched");
  assert.equal(r.mark, 0x03, "landed at rank 3");
  assert.equal(r.pc, SENTINEL);
  assert.equal(r.sp, 0x8780, "stack balanced");
});

// -- Case D: beats rank 2 -> lands at rank 2, rank 2 pushed to rank 3 ---------
test("loc_4d3a D: candidate beats rank 2, old rank 2 shifts down to rank 3", () => {
  const r = run(loc_4d3a, 0x4000);
  assert.equal(r.cycles, 443);
  assert.equal(r.v1, 0x5000, "rank 1 untouched");
  assert.equal(r.v2, 0x4000, "candidate now at rank 2");
  assert.equal(r.v3, 0x3000, "old rank-2 value dropped to rank 3");
  assert.deepEqual(r.ini2, [0xff, 0xff, 0xff], "rank-2 initials stamped 0xff");
  assert.deepEqual(r.ini3, [0xb1, 0xb2, 0xb3], "old rank-2 initials moved to rank 3");
  assert.deepEqual(r.ini1, [0xa1, 0xa2, 0xa3], "rank-1 initials untouched");
  assert.equal(r.mark, 0x02, "landed at rank 2");
  assert.equal(r.pc, SENTINEL);
  assert.equal(r.sp, 0x8780, "stack balanced");
});

// -- Case E: beats rank 1 -> full cascade, every rank shifts down -------------
function checkCascade(r) {
  assert.equal(r.cycles, 615, "full-cascade T-state total");
  assert.equal(r.v1, 0x6000, "candidate now at rank 1 (top)");
  assert.equal(r.v2, 0x5000, "old rank-1 value dropped to rank 2");
  assert.equal(r.v3, 0x3000, "old rank-2 value dropped to rank 3");
  assert.deepEqual(r.ini1, [0xff, 0xff, 0xff], "rank-1 initials stamped 0xff");
  assert.deepEqual(r.ini2, [0xa1, 0xa2, 0xa3], "old rank-1 initials moved to rank 2");
  assert.deepEqual(r.ini3, [0xb1, 0xb2, 0xb3], "old rank-2 initials moved to rank 3");
  assert.equal(r.mark, 0x01, "landed at rank 1");
  assert.equal(r.pc, SENTINEL, "ret returns to caller");
  assert.equal(r.sp, 0x8780, "stack balanced");
}
test("loc_4d3a E: candidate beats the top, whole table cascades down", () => {
  checkCascade(run(loc_4d3a, 0x6000));
});

// -- Case F: high bytes tie at rank 2, the LOW byte decides it beats rank 2 ---
test("loc_4d3a F: low-byte tie-break routes the candidate above rank 2", () => {
  const table = { ...DEF, v2: 0x3020 }; // rank2 low = 0x20
  const r = run(loc_4d3a, 0x3050, table); // same high (0x30), higher low (0x50)
  assert.equal(r.cycles, 463);
  assert.equal(r.v1, 0x5000, "rank 1 untouched");
  assert.equal(r.v2, 0x3050, "candidate beats rank 2 on the low byte");
  assert.equal(r.v3, 0x3020, "old rank-2 value dropped to rank 3");
  assert.deepEqual(r.ini2, [0xff, 0xff, 0xff], "rank-2 initials stamped 0xff");
  assert.deepEqual(r.ini3, [0xb1, 0xb2, 0xb3], "old rank-2 initials moved to rank 3");
  assert.equal(r.mark, 0x02, "landed at rank 2");
  assert.equal(r.sp, 0x8780, "stack balanced");
});

// -- MUTATION -----------------------------------------------------------------
// A straight-line replay of Case E's taken path (entry -> 0x4d4f -> 0x4d79 ->
// 0x4dc1) with ONE instruction deleted: the `ld (0x8041),hl` at 0x4dc1 that
// pushes the old rank-1 value down to the rank-2 slot. The rank-2 value is then
// left at its original 0x3000 (should be 0x5000) and the routine costs 16 T less
// (599 vs 615). checkCascade must reject both.
function loc_4d3a_mut(m) {
  const { regs, mem } = m;
  // entry (0x4d3a)
  regs.hl = mem.read16(0x8046);
  m.step(0x4d3d, 16);
  regs.a = mem.read8(0x8031);
  m.step(0x4d40, 13);
  regs.e = regs.a;
  m.step(0x4d41, 4);
  regs.a = mem.read8(0x8034);
  m.step(0x4d44, 13);
  regs.d = regs.a;
  m.step(0x4d45, 4);
  regs.cp(regs.h);
  m.step(0x4d46, 4);
  m.step(0x4d47, 5); // ret c not taken
  m.step(0x4d49, 7); // jr z not taken
  m.step(0x4d4f, 12); // jr nc taken
  // loc_4d4f
  regs.hl = mem.read16(0x8041);
  m.step(0x4d52, 16);
  regs.a = regs.d;
  m.step(0x4d53, 4);
  regs.cp(regs.h);
  m.step(0x4d54, 4);
  m.step(0x4d56, 7); // jr c not taken
  m.step(0x4d58, 7); // jr z not taken
  m.step(0x4d79, 12); // jr nc taken
  // loc_4d79
  mem.write16(0x8046, regs.hl);
  m.step(0x4d7c, 16);
  regs.ix = 0x8043;
  m.step(0x4d80, 14);
  regs.iy = 0x803e;
  m.step(0x4d84, 14);
  regs.a = mem.read8(regs.iy);
  m.step(0x4d87, 19);
  mem.write8(regs.ix, regs.a);
  m.step(0x4d8a, 19);
  regs.a = mem.read8((regs.iy + 1) & 0xffff);
  m.step(0x4d8d, 19);
  mem.write8((regs.ix + 1) & 0xffff, regs.a);
  m.step(0x4d90, 19);
  regs.a = mem.read8((regs.iy + 2) & 0xffff);
  m.step(0x4d93, 19);
  mem.write8((regs.ix + 2) & 0xffff, regs.a);
  m.step(0x4d96, 19);
  regs.hl = mem.read16(0x803c);
  m.step(0x4d99, 16);
  regs.a = regs.d;
  m.step(0x4d9a, 4);
  regs.cp(regs.h);
  m.step(0x4d9b, 4);
  m.step(0x4d9d, 7); // jr c not taken
  m.step(0x4d9f, 7); // jr z not taken
  m.step(0x4dc1, 12); // jr nc taken
  // loc_4dc1 -- BUG: `ld (0x8041),hl` (16 T) deleted; old rank-1 value never
  // reaches the rank-2 slot.
  regs.iy = 0x8039;
  m.step(0x4dc8, 14);
  regs.ix = 0x803e;
  m.step(0x4dcc, 14);
  regs.a = mem.read8(regs.iy);
  m.step(0x4dcf, 19);
  mem.write8(regs.ix, regs.a);
  m.step(0x4dd2, 19);
  regs.a = mem.read8((regs.iy + 1) & 0xffff);
  m.step(0x4dd5, 19);
  mem.write8((regs.ix + 1) & 0xffff, regs.a);
  m.step(0x4dd8, 19);
  regs.a = mem.read8((regs.iy + 2) & 0xffff);
  m.step(0x4ddb, 19);
  mem.write8((regs.ix + 2) & 0xffff, regs.a);
  m.step(0x4dde, 19);
  mem.write16(0x803c, regs.de);
  m.step(0x4de2, 20);
  regs.a = 0x01;
  m.step(0x4de4, 7);
  mem.write8(0x8048, regs.a);
  m.step(0x4de7, 13);
  regs.ix = 0x8039;
  m.step(0x4deb, 14);
  mem.write8(regs.ix, 0xff);
  m.step(0x4def, 19);
  mem.write8((regs.ix + 1) & 0xffff, 0xff);
  m.step(0x4df3, 19);
  mem.write8((regs.ix + 2) & 0xffff, 0xff);
  m.step(0x4df7, 19);
  m.ret();
}

test("mutation (deleted rank-1 push-down) is caught", () => {
  const bad = run(loc_4d3a_mut, 0x6000);
  // Sanity: the mutant really does diverge (rank-2 value stale, 16 T lighter).
  assert.equal(bad.v2, 0x3000, "mutant leaves rank 2 at its old value");
  assert.equal(bad.cycles, 599, "mutant is 16 T lighter than the real routine");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkCascade(bad));
});
