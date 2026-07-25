// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3425 (ROM 0x3425-0x3457). Asserts the T-state total and
// the routine's key register/flag/memory/control-flow effects against the
// disassembly across all THREE exit paths (full 0x35fe scan, `ret nz` on a
// first-scan miss, `ret z` on a zero index), plus a deliberate mutation the
// invariant checker must catch.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3425 } from "../loc_3425.js";

// A minimal, faithful stand-in for the machine the routine runs on: real Regs,
// real AddressSpace/Io, and step/call/ret modelled exactly like the DK machine
// (step advances PC + charges T-states; ret charges its cycles and records that
// the routine returned). loc_3425 makes no m.call. The cpir tables live in ROM,
// so the tests seed them straight into mem.rom (write8 to ROM would throw).
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.cycles = 0;
    this.pc = 0x3425;
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
  }
  ret(cycles = 10) {
    this.cycles += cycles;
    this.returned = true;
  }
}

// ---- FULL path -------------------------------------------------------------
// Inputs chosen so both scans hit and both mid-routine returns are skipped:
//   (0x808d)      = 0x30  -> table1 index = 0x50, table2 index = 0x10 (0x30-0x20)
//   word@0x8089   = 0x8100 -> pointer = 0x8100 + 0x20 = 0x8120 -> (0x8134)
//   (0x8120)      = 0x50  -> key1; found at rom[0x354e + 2]  (base 0x34fe+0x50) -> n1 = 3
//   (0x8121)      = 0x77  -> key2 = (ix+1); found at rom[0x360e + 4] (base 0x35fe+0x10) -> n2 = 5
function setupFull(m) {
  m.mem.write8(0x808d, 0x30);
  m.mem.write8(0x8089, 0x00);
  m.mem.write8(0x808a, 0x81); // word@0x8089 = 0x8100
  m.mem.write8(0x8120, 0x50); // key1
  m.mem.write8(0x8121, 0x77); // key2 (the following byte)
  m.mem.rom[0x3550] = 0x50; // table1 row 0x354e, offset 2 -> n1 = 3
  m.mem.rom[0x3612] = 0x77; // table2 row 0x360e, offset 4 -> n2 = 5
}

// Invariants defining correct behaviour on the full path. Shared by the real
// routine and the mutant so the mutation is caught by exactly the checks that
// pass for the real routine.
function checkFull(m) {
  assert.equal(m.cycles, 388, "T-state total (both scans hit, no early return)");
  assert.equal(m.mem.read16(0x8134), 0x8120, "(0x8134) = (word@0x8089)+0x20");
  assert.equal(m.regs.d, 0x00, "d stays 0 (zero-extends the index for both DE builds)");
  assert.equal(m.regs.e, 0x10, "e rebuilt = (0x808d)-0x20 for the 0x35fe scan");
  assert.equal(m.regs.ix, 0x8120, "ix reloaded from the saved pointer (0x8134)");
  assert.equal(m.regs.hl, 0x3613, "HL = matched addr 0x3612 + 1 after the 0x35fe cpir");
  assert.equal(m.regs.bc, 0x001b, "BC = 0x20 - n2 = 0x20 - 5 after the 0x35fe cpir");
  assert.equal(m.regs.fZ, true, "final Z set -- key2 matched in the 0x35fe row");
  assert.equal(m.returned, true, "routine returned");
}

test("loc_3425 full path: pointer saved, both cpir rows hit, ret at 0x3457", () => {
  const m = new MockMachine();
  setupFull(m);
  loc_3425(m);
  checkFull(m);
});

test("loc_3425 first-scan miss: ret nz taken, no 0x35fe scan, ix untouched", () => {
  const m = new MockMachine();
  m.mem.write8(0x808d, 0x30); // table1 row 0x354e
  m.mem.write8(0x8089, 0x00);
  m.mem.write8(0x808a, 0x81); // pointer -> 0x8120
  m.mem.write8(0x8120, 0xab); // key1 absent from the (zero-filled) 0x354e row
  loc_3425(m);

  // 112 (pre-cpir) + cpir n1=32 (21*31+16 = 667) + ret nz taken (11) = 790.
  assert.equal(m.cycles, 790, "T-state total (32-byte miss + ret nz taken)");
  assert.equal(m.mem.read16(0x8134), 0x8120, "pointer still saved before the miss");
  assert.equal(m.regs.ix, 0xffff, "ix never reloaded -- second scan not reached");
  assert.equal(m.regs.fNZ, true, "first cpir left NZ (no match) -> ret nz taken");
  assert.equal(m.returned, true, "routine returned via ret nz");
});

test("loc_3425 zero index: first scan hits, ret z taken, no 0x35fe scan", () => {
  const m = new MockMachine();
  m.mem.write8(0x808d, 0x00); // table1 row 0x351e (0x34fe+0x20); and index == 0
  m.mem.write8(0x8089, 0x00);
  m.mem.write8(0x808a, 0x81); // pointer -> 0x8120
  m.mem.write8(0x8120, 0x50); // key1
  m.mem.rom[0x351f] = 0x50; // row 0x351e, offset 1 -> n1 = 2 (match, Z set)
  loc_3425(m);

  // 112 + cpir n1=2 (37) + ret nz not taken (5) + ld a (13) + and a (4)
  //   + ret z taken (11) = 182.
  assert.equal(m.cycles, 182, "T-state total (match then ret z on zero index)");
  assert.equal(m.regs.ix, 0xffff, "ix never reloaded -- second scan not reached");
  assert.equal(m.regs.fZ, true, "`and a` on index 0 -> Z set -> ret z taken");
  assert.equal(m.returned, true, "routine returned via ret z");
});

// ---- MUTATION --------------------------------------------------------------
// A faithful copy of the translation with ONE deliberate break: `sub 0x20` at
// 0x3444 replaced by `add 0x20`. The 0x35fe row index becomes (0x808d)+0x20 =
// 0x50 instead of 0x10, so the second cpir scans row 0x364e (zero-filled) and
// never finds key2 -- Z ends CLEAR, HL/BC/cycles all diverge. checkFull must
// reject it. This proves the flag/register/cycle invariants have teeth.
function loc_3425_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x808d);
  m.step(0x3428, 13);
  regs.add(0x20);
  m.step(0x342a, 7);
  regs.e = regs.a;
  m.step(0x342b, 4);
  regs.d = 0x00;
  m.step(0x342d, 7);
  regs.hl = mem.read16(0x8089);
  m.step(0x3430, 16);
  regs.bc = 0x0020;
  m.step(0x3433, 10);
  regs.addHl(regs.bc);
  m.step(0x3434, 11);
  mem.write16(0x8134, regs.hl);
  m.step(0x3437, 16);
  regs.a = mem.read8(regs.hl);
  m.step(0x3438, 7);
  regs.hl = 0x34fe;
  m.step(0x343b, 10);
  regs.addHl(regs.de);
  m.step(0x343c, 11);
  const n1 = regs.cpir(mem);
  m.step(0x343e, 21 * (n1 - 1) + 16);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x343f, 5);
  regs.a = mem.read8(0x808d);
  m.step(0x3442, 13);
  regs.and(regs.a);
  m.step(0x3443, 4);
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x3444, 5);
  regs.add(0x20); // <-- MUTATION: `add 0x20` instead of `sub 0x20`
  m.step(0x3446, 7);
  regs.e = regs.a;
  m.step(0x3447, 4);
  regs.ix = mem.read16(0x8134);
  m.step(0x344b, 20);
  regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
  m.step(0x344e, 19);
  regs.hl = 0x35fe;
  m.step(0x3451, 10);
  regs.addHl(regs.de);
  m.step(0x3452, 11);
  regs.bc = 0x0020;
  m.step(0x3455, 10);
  const n2 = regs.cpir(mem);
  m.step(0x3457, 21 * (n2 - 1) + 16);
  m.ret();
}

test("MUTATION caught: `add 0x20` for `sub 0x20` sends the 0x35fe scan to the wrong row", () => {
  const good = new MockMachine();
  setupFull(good);
  loc_3425(good);
  checkFull(good); // sanity: the real routine passes

  const bad = new MockMachine();
  setupFull(bad);
  loc_3425_MUTANT(bad);
  assert.equal(bad.regs.fZ, false, "mutant scans the zero-filled row 0x364e -> no match, Z clear");
  assert.notEqual(bad.regs.hl, 0x3613, "mutant HL diverges from the real match");
  assert.throws(() => checkFull(bad), "the invariant checker must reject the mutant");
});
