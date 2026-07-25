// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_46af (ROM 0x46AF-0x46F3). Asserts the T-state total and
// the routine's key register/flag/memory/control-flow effects against the
// disassembly on BOTH the leading-zero-blank path and the all-digits path,
// plus a deliberate mutation the invariant checker must catch.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_46af } from "../loc_46af.js";

// Minimal faithful stand-in for the machine: real Regs, real AddressSpace/Io,
// step/ret/call/push16 modelled exactly like the DK machine (step advances PC +
// charges T-states; ret charges its own T and marks the return). loc_46af makes
// no calls, so call/push16 exist only for shape.
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM
    this.cycles = 0;
    this.pc = 0x46af;
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
  }
  call(addr) {
    this.calls.push(addr);
    return undefined;
  }
  ret(cycles = 10) {
    this.cycles += cycles;
    this.returned = true;
  }
  push16(value) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, value & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }
}

// ---- PATH 1: leading-zero-blank path ---------------------------------------
// (0x8002) = 0x02 (!=1) -> jr nz taken -> ix = 0x90c1
// (0x8031) = 0x35       -> (ix+0x00)=0x05 low, (ix+0x20)=0x03 high
// (0x8034) = 0x00       -> high nibble 0 -> (ix+0x60)=0x24 (blank), b=0x24
//                       -> low  nibble 0 -> (ix+0x40)=b=0x24 (blank)
// ix=0x90c1: +0x00=0x90c1 +0x20=0x90e1 +0x40=0x9101 +0x60=0x9121
function setupPath1(m) {
  m.mem.write8(0x8002, 0x02);
  m.mem.write8(0x8031, 0x35);
  m.mem.write8(0x8034, 0x00);
}

// Invariants defining correct behaviour on PATH 1. Shared by the real-routine
// test and the mutation test so the mutation is caught by exactly the checks
// that pass for the real routine.
function checkPath1(m) {
  assert.equal(m.cycles, 285, "T-state total (A taken, B/C blank arms)");
  assert.equal(m.regs.ix, 0x90c1, "0x8002 != 1 -> ix base 0x90c1");
  assert.equal(m.mem.read8(0x90c1), 0x05, "(ix+0x00) = (0x8031) & 0x0f");
  assert.equal(m.mem.read8(0x90e1), 0x03, "(ix+0x20) = (0x8031) >> 4");
  assert.equal(m.mem.read8(0x9121), 0x24, "(ix+0x60) = blank tile (0x8034>>4 == 0)");
  assert.equal(m.mem.read8(0x9101), 0x24, "(ix+0x40) = blank tile (low nibble 0, hi was 0)");
  assert.equal(m.regs.b, 0x24, "b holds the blank tile after the high-nibble blank arm");
  assert.equal(m.regs.fZ, true, "final flags from `and 0x0f` on a zero low nibble -> Z set");
  assert.equal(m.calls.length, 0, "loc_46af makes no calls");
  assert.equal(m.returned, true, "routine returned");
}

test("loc_46af blank path: 0x90c1 base, 0x8034 pair blanked to tile 0x24", () => {
  const m = new MockMachine();
  setupPath1(m);
  loc_46af(m);
  checkPath1(m);
});

// ---- PATH 2: all-digits path (no blanking) ---------------------------------
// (0x8002) = 0x01       -> dec a == 0 -> jr nz NOT taken -> ix = 0x9301
// (0x8031) = 0x9a       -> (ix+0x00)=0x0a low, (ix+0x20)=0x09 high
// (0x8034) = 0x57       -> high nibble 5 (!=0) -> (ix+0x60)=0x05, b stays 0x00
//                       -> low  nibble 7 (!=0) -> (ix+0x40)=0x07
// ix=0x9301: +0x00=0x9301 +0x20=0x9321 +0x40=0x9341 +0x60=0x9361
test("loc_46af digits path: 0x9301 base, both nibbles of each byte rendered", () => {
  const m = new MockMachine();
  m.mem.write8(0x8002, 0x01);
  m.mem.write8(0x8031, 0x9a);
  m.mem.write8(0x8034, 0x57);
  loc_46af(m);

  assert.equal(m.cycles, 287, "T-state total (A not taken -> jr+jr, B/C value arms)");
  assert.equal(m.regs.ix, 0x9301, "0x8002 == 1 -> ix base 0x9301");
  assert.equal(m.mem.read8(0x9301), 0x0a, "(ix+0x00) = (0x8031) & 0x0f");
  assert.equal(m.mem.read8(0x9321), 0x09, "(ix+0x20) = (0x8031) >> 4");
  assert.equal(m.mem.read8(0x9361), 0x05, "(ix+0x60) = (0x8034) >> 4");
  assert.equal(m.mem.read8(0x9341), 0x07, "(ix+0x40) = (0x8034) & 0x0f");
  assert.equal(m.regs.b, 0x00, "b never overwritten -- high nibble was present");
  assert.equal(m.regs.fNZ, true, "final flags from `and 0x0f` on nibble 7 -> NZ");
  assert.equal(m.returned, true, "routine returned");
});

// ---- MUTATION --------------------------------------------------------------
// A faithful copy with ONE deliberate break: the blank tile at 0x46e4,
// `ld a,0x24`, replaced by `ld a,0x00`. On PATH 1 (blank arm taken) this makes
// the blanked cells (ix+0x60)/(ix+0x40) come out 0x00 instead of 0x24, which
// checkPath1 must reject. Same path -> same T-total, so the MEMORY invariant is
// what has to have teeth.
function loc_46af_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8002);
  m.step(0x46b2, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x46b3, 4);
  if (regs.fNZ) {
    m.step(0x46bb, 12);
    regs.ix = 0x90c1;
    m.step(0x46bf, 14);
  } else {
    m.step(0x46b5, 7);
    regs.ix = 0x9301;
    m.step(0x46b9, 14);
    m.step(0x46bf, 12);
  }
  regs.a = mem.read8(0x8031);
  m.step(0x46c2, 13);
  regs.c = regs.a;
  m.step(0x46c3, 4);
  regs.and(0x0f);
  m.step(0x46c5, 7);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x46c8, 19);
  regs.a = regs.c;
  m.step(0x46c9, 4);
  regs.a = regs.srl(regs.a);
  m.step(0x46cb, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x46cd, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x46cf, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x46d1, 8);
  mem.write8((regs.ix + 0x20) & 0xffff, regs.a);
  m.step(0x46d4, 19);
  regs.a = mem.read8(0x8034);
  m.step(0x46d7, 13);
  regs.c = regs.a;
  m.step(0x46d8, 4);
  regs.b = 0x00;
  m.step(0x46da, 7);
  regs.a = regs.srl(regs.a);
  m.step(0x46dc, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x46de, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x46e0, 8);
  regs.a = regs.srl(regs.a);
  m.step(0x46e2, 8);
  if (regs.fNZ) {
    m.step(0x46e7, 12);
  } else {
    m.step(0x46e4, 7);
    regs.a = 0x00; // <-- MUTATION: `ld a,0x00` instead of `ld a,0x24`
    m.step(0x46e6, 7);
    regs.b = regs.a;
    m.step(0x46e7, 4);
  }
  mem.write8((regs.ix + 0x60) & 0xffff, regs.a);
  m.step(0x46ea, 19);
  regs.a = regs.c;
  m.step(0x46eb, 4);
  regs.and(0x0f);
  m.step(0x46ed, 7);
  if (regs.fNZ) {
    m.step(0x46f0, 12);
  } else {
    m.step(0x46ef, 7);
    regs.a = regs.b;
    m.step(0x46f0, 4);
  }
  mem.write8((regs.ix + 0x40) & 0xffff, regs.a);
  m.step(0x46f3, 19);
  m.ret(10);
}

test("MUTATION caught: `ld a,0x00` for `ld a,0x24` breaks the blank tile", () => {
  const good = new MockMachine();
  setupPath1(good);
  loc_46af(good);
  checkPath1(good); // sanity: the real routine passes

  const bad = new MockMachine();
  setupPath1(bad);
  loc_46af_MUTANT(bad);
  assert.equal(bad.mem.read8(0x9121), 0x00, "mutant writes 0x00 where the blank tile 0x24 belongs");
  assert.throws(() => checkPath1(bad), "the invariant checker must reject the mutant");
});
