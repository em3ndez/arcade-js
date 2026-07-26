// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_287a (ROM 0x287a-0x28a8), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake
// ROM (the copyrighted image is never committed). loc_287a is straight-line: it
// writes a fixed header + zeroes a scratch block, LDIRs 0x18 bytes from ROM 0x2dab
// into work RAM 0x80c3, sets 0x80c2=0x20, then TAIL-JUMPS to 0x2f2f. The tail-call
// is stubbed as a bare `ret` (pop + no cycle charge) so the asserted T-state total
// is loc_287a's OWN cost, and so 0x2f2f's ret is observed returning to loc_287a's
// caller. A deliberate mutation (LDIR source off by one) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_287a } from "../loc_287a.js";

const SRC = 0x2dab; // LDIR source in ROM
const DST = 0x80c3; // LDIR dest in work RAM
const LEN = 0x18; // 24 bytes
const TAIL = 0x2f2f; // tail-jump target
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret must land on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// Seed a broad ROM window around the source so an off-by-one read is still defined
// AND yields a different block (the pattern is not constant).
function buildRom() {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  for (let addr = 0x2d80; addr <= 0x2de0; addr++) rom[addr] = (addr * 7 + 5) & 0xff;
  return rom;
}

// -- minimal machine: real mem/io/regs + the step/call/ldir seam -------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x287a;
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address on top
  // of the stack). For a TAIL-JUMP nothing was pushed by loc_287a, so this pops the
  // caller's return address -- exactly modelling 0x2f2f returning to loc_287a's
  // caller. No cycle charge: 0x2f2f's own cost is not loc_287a's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
  // Byte-for-byte the machine.js semantics: 21 T per repeating iter, 16 on exit.
  ldirAt(self, nextAddr) {
    const { regs, mem } = this;
    for (;;) {
      mem.write8(regs.de, mem.read8(regs.hl));
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.de = (regs.de + 1) & 0xffff;
      regs.bc = (regs.bc - 1) & 0xffff;
      if (regs.bc === 0) {
        this.step(nextAddr, 16);
        return;
      }
      this.step(self, 21);
    }
  }
}

function run(fn) {
  const rom = buildRom();
  const m = new TestMachine(rom);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  const copied = m.mem.workRam.slice(DST - 0x8000, DST - 0x8000 + LEN);
  const expectCopy = new Uint8Array(LEN);
  for (let i = 0; i < LEN; i++) expectCopy[i] = rom[SRC + i];
  return {
    cycles: m.cycles,
    copied,
    expectCopy,
    w80a9: m.mem.read8(0x80a9),
    w80aa: m.mem.read8(0x80aa),
    w80ab: m.mem.read8(0x80ab),
    w80ac: m.mem.read8(0x80ac),
    w80b1: m.mem.read8(0x80b1),
    w80bd: m.mem.read8(0x80bd),
    w80c0: m.mem.read8(0x80c0),
    w80c1: m.mem.read8(0x80c1),
    w80c2: m.mem.read8(0x80c2),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    bc: m.regs.bc,
    de: m.regs.de,
    hl: m.regs.hl,
  };
}

// Own-instruction T-states: 7+13+7+13+7 +13+13+13+13+13 +13 +10+10+10 +499(ldir)
// +7+13 +10(jp) = 684.
const EXPECT_T = 684;

// Full spec, factored so the mutant runs through the same checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXPECT_T, "T-state total");
  // fixed header
  assert.equal(res.w80aa, 0x30, "0x80aa header = 0x30");
  assert.equal(res.w80ab, 0x07, "0x80ab header = 0x07");
  // zeroed scratch/counter bytes
  assert.equal(res.w80a9, 0x00, "0x80a9 zeroed");
  assert.equal(res.w80ac, 0x00, "0x80ac zeroed");
  assert.equal(res.w80b1, 0x00, "0x80b1 zeroed");
  assert.equal(res.w80bd, 0x00, "0x80bd zeroed");
  assert.equal(res.w80c0, 0x00, "0x80c0 zeroed");
  assert.equal(res.w80c1, 0x00, "0x80c1 zeroed");
  // post-LDIR write
  assert.equal(res.w80c2, 0x20, "0x80c2 = 0x20");
  // block copy
  assert.deepEqual(res.copied, res.expectCopy, "0x18-byte LDIR copy 0x2dab->0x80c3");
  // control flow: tail-jump to 0x2f2f whose ret lands on the caller
  assert.deepEqual(res.calls, [TAIL], "tail-jumps to 0x2f2f exactly once");
  assert.equal(res.pc, SENTINEL, "0x2f2f's ret returns to loc_287a's caller");
  assert.equal(res.sp, SP0, "stack balanced (no leaked push)");
  // registers left by the routine
  assert.equal(res.a, 0x20, "A = 0x20 on exit");
  assert.equal(res.bc, 0x0000, "BC = 0 after LDIR");
  assert.equal(res.de, (DST + LEN) & 0xffff, "DE past copy dest (0x80db)");
  assert.equal(res.hl, (SRC + LEN) & 0xffff, "HL past copy source (0x2dc3)");
}

test("loc_287a: initialises the block, LDIRs 0x18 bytes, tail-jumps to 0x2f2f, 684 T", () => {
  checkSpec(run(loc_287a));
});

// -- MUTATION: LDIR source off by one (ld hl,0x2dab -> 0x2dac). The copied block is
// shifted by a byte; the cycle count is IDENTICAL (still 0x18 bytes), so ONLY the
// copied-content assertion can catch it -- proving that assertion has teeth.
function loc_287a_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x30;
  m.step(0x287c, 7);
  mem.write8(0x80aa, regs.a);
  m.step(0x287f, 13);
  regs.a = 0x07;
  m.step(0x2881, 7);
  mem.write8(0x80ab, regs.a);
  m.step(0x2884, 13);
  regs.a = 0x00;
  m.step(0x2886, 7);
  mem.write8(0x80a9, regs.a);
  m.step(0x2889, 13);
  mem.write8(0x80ac, regs.a);
  m.step(0x288c, 13);
  mem.write8(0x80b1, regs.a);
  m.step(0x288f, 13);
  mem.write8(0x80bd, regs.a);
  m.step(0x2892, 13);
  mem.write8(0x80c1, regs.a);
  m.step(0x2895, 13);
  mem.write8(0x80c0, regs.a);
  m.step(0x2898, 13);
  regs.de = 0x80c3;
  m.step(0x289b, 10);
  regs.hl = 0x2dac; // BUG: source should be 0x2dab
  m.step(0x289e, 10);
  regs.bc = 0x0018;
  m.step(0x28a1, 10);
  m.ldirAt(0x28a1, 0x28a3);
  regs.a = 0x20;
  m.step(0x28a5, 7);
  mem.write8(0x80c2, regs.a);
  m.step(0x28a8, 13);
  m.step(0x2f2f, 10);
  return m.call(0x2f2f);
}

test("mutation (LDIR source off by one) is caught by the spec", () => {
  const bad = run(loc_287a_mutant);
  // Sanity: the mutant copied the WRONG block but mischarged NOTHING.
  assert.notDeepEqual(bad.copied, bad.expectCopy, "mutant copied a shifted block");
  assert.equal(bad.cycles, EXPECT_T, "mutant's cycle count is identical");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkSpec(bad));
});
