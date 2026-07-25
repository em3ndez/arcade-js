// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_0673 (ROM 0x0673-0x06AB), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake
// ROM (the copyrighted image is never committed). Callees (0x4bff, 0x46f4, 0x472c,
// 0x47a1) are stubbed as trivial "pop-and-return" routines that balance the stack
// but add no cycles, so the asserted T-state total is loc_0673's OWN instruction
// cost. A deliberate mutation (branch polarity flipped) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_0673 } from "../loc_0673.js";

// -- seeded ROM: three distinct 0x400-byte source tables ----------------------
const SRC_A = 0x0762; // tilemap source when 0x8028 bit0 set
const SRC_B = 0x0b62; // tilemap source when 0x8028 bit0 clear
const SRC_C = 0x0f62; // colour source (fixed)
const LEN = 0x0400;

const patA = (i) => (i * 3 + 1) & 0xff;
const patB = (i) => (i * 7 + 2) & 0xff;
const patC = (i) => (i * 5 + 3) & 0xff;

function buildRom() {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  for (let i = 0; i < LEN; i++) {
    rom[SRC_A + i] = patA(i);
    rom[SRC_B + i] = patB(i);
    rom[SRC_C + i] = patC(i);
  }
  return rom;
}

function expectArr(pat) {
  const a = new Uint8Array(LEN);
  for (let i = 0; i < LEN; i++) a[i] = pat(i);
  return a;
}

const EXP_VIDEO_A = expectArr(patA);
const EXP_VIDEO_B = expectArr(patB);
const EXP_COLOR = expectArr(patC);

const SENTINEL = 0xbeef; // return address the routine's final `ret` must land on

// -- minimal machine: real mem/io/regs + the step/call/ldir seam -------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x0673;
    this.calls = [];
    this.regs.sp = 0x8780; // inside work RAM (0x8000-0x87ff) so pushes are mapped
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address the
  // CALL pushed) so the stack stays balanced. No cycle charge -- the callee's own
  // cost is not loc_0673's.
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

function run(fn, bit0) {
  const m = new TestMachine(buildRom());
  m.mem.write8(0x8028, bit0 ? 0x01 : 0x00);
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    video: m.mem.videoRam.slice(),
    color: m.mem.colorRam.slice(),
    w805c: m.mem.read8(0x805c),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    bc: m.regs.bc,
    de: m.regs.de,
    hl: m.regs.hl,
  };
}

// Full spec assertion, factored so the mutant can be run through the same checks.
function checkSpec(res, expVideo, expCycles) {
  assert.equal(res.cycles, expCycles, "T-state total");
  assert.deepEqual(res.video, expVideo, "video RAM copy");
  assert.deepEqual(res.color, EXP_COLOR, "colour RAM copy");
  assert.equal(res.w805c, 1, "0x805c armed to 1");
  assert.deepEqual(res.calls, [0x4bff, 0x4bff, 0x46f4, 0x472c, 0x47a1], "call sequence");
  assert.equal(res.pc, SENTINEL, "ret lands on caller");
  assert.equal(res.sp, 0x8780, "stack balanced");
  assert.equal(res.a, 1, "A = 1 on exit");
  assert.equal(res.bc, 0, "BC = 0 after final ldir");
  assert.equal(res.de, 0x8c00, "DE past colour dest");
  assert.equal(res.hl, 0x1362, "HL past colour source");
}

// bit0 set path: HL kept at 0x0762 (source A), jr taken (12 T).
//   own-instruction total = 43220 T (two 0x400 ldirs = 2 * 21499).
test("loc_0673: 0x8028 bit0 SET copies source A, total 43220 T", () => {
  checkSpec(run(loc_0673, 1), EXP_VIDEO_A, 43220);
});

// bit0 clear path: falls through to ld hl,0x0b62 (source B). jr not-taken (7 T)
//   + ld hl (10 T) => +5 T over the taken path => 43225 T.
test("loc_0673: 0x8028 bit0 CLEAR copies source B, total 43225 T", () => {
  const res = run(loc_0673, 0);
  assert.equal(res.cycles, 43225, "T-state total (not-taken path)");
  assert.deepEqual(res.video, EXP_VIDEO_B, "video RAM = source B");
  assert.deepEqual(res.color, EXP_COLOR, "colour RAM copy");
  assert.equal(res.w805c, 1);
});

// -- MUTATION: branch polarity flipped (fZ instead of fNZ). With bit0 set this
// wrongly falls through and copies source B (and costs 43225 T). The spec check
// for the bit0-set path MUST reject it.
function loc_0673_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x0675, 7);
  m.push16(0x0678);
  m.step(0x4bff, 17);
  m.call(0x4bff);
  regs.de = 0x9000;
  m.step(0x067b, 10);
  regs.hl = 0x0762;
  m.step(0x067e, 10);
  regs.a = mem.read8(0x8028);
  m.step(0x0681, 13);
  regs.bit(0, regs.a);
  m.step(0x0683, 8);
  if (regs.fZ) { // BUG: should be fNZ
    m.step(0x0688, 12);
  } else {
    m.step(0x0685, 7);
    regs.hl = 0x0b62;
    m.step(0x0688, 10);
  }
  regs.bc = 0x0400;
  m.step(0x068b, 10);
  m.ldirAt(0x068b, 0x068d);
  regs.a = 0x01;
  m.step(0x068f, 7);
  m.push16(0x0692);
  m.step(0x4bff, 17);
  m.call(0x4bff);
  regs.de = 0x8800;
  m.step(0x0695, 10);
  regs.hl = 0x0f62;
  m.step(0x0698, 10);
  regs.bc = 0x0400;
  m.step(0x069b, 10);
  m.ldirAt(0x069b, 0x069d);
  m.push16(0x06a0);
  m.step(0x46f4, 17);
  m.call(0x46f4);
  m.push16(0x06a3);
  m.step(0x472c, 17);
  m.call(0x472c);
  m.push16(0x06a6);
  m.step(0x47a1, 17);
  m.call(0x47a1);
  regs.a = 0x01;
  m.step(0x06a8, 7);
  mem.write8(0x805c, regs.a);
  m.step(0x06ab, 13);
  m.ret();
}

test("mutation (branch polarity flipped) is caught by the spec", () => {
  // Sanity: the mutant really does diverge on the bit0-set path.
  const bad = run(loc_0673_mutant, 1);
  assert.deepEqual(bad.video, EXP_VIDEO_B); // copied the WRONG table
  assert.equal(bad.cycles, 43225); // and mischarged the branch
  // The spec that the real routine passes must REJECT the mutant.
  assert.throws(() => checkSpec(bad, EXP_VIDEO_A, 43220));
});
