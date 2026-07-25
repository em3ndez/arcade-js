// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_46f4 (ROM 0x46F4-0x472B), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake
// ROM (the copyrighted image is never committed). loc_46f4 makes no calls, so its
// asserted T-state total is its OWN instruction cost; the trailing `ret` (10 T)
// is charged by the harness ret(), matching machine.js. A deliberate mutation
// (inc ix -> dec ix, so the source strip is copied BACKWARDS) is asserted caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_46f4 } from "../loc_46f4.js";

// -- seeded ROM: 32-byte tile source strip at 0x4AAB -------------------------
const SRC = 0x4aab;
const N_TILES = 0x20;
const srcByte = (i) => (i * 13 + 5) & 0xff; // distinct, order-sensitive pattern

function buildRom() {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  for (let i = 0; i < N_TILES; i++) rom[SRC + i] = srcByte(i);
  return rom;
}

const SENTINEL = 0xbeef; // return address the routine's final `ret` must land on

// Expected total: prologue 41 + loop1 1915 + between 34 + loop2 274 + between 17
//   + loop3 274 + between 24 + loop4 305 + ret 10 = 2894 T.
const EXP_CYCLES = 2894;

// -- expected RAM images -----------------------------------------------------
// Loop 1: video RAM, 32 tiles UP the column from 0x93E0 stride -0x20.
function expectVideo() {
  const v = new Uint8Array(0x400);
  for (let i = 0; i < N_TILES; i++) {
    const addr = 0x93e0 - i * 0x20;
    v[(addr - 0x9000) & 0x3ff] = srcByte(i);
  }
  return v;
}
// Loops 2-4: colour RAM. 0x02 down 0x8BA0 (9) and 0x8940 (9); 0x03 down 0x8A80 (10).
function expectColor() {
  const c = new Uint8Array(0x400);
  for (let i = 0; i < 9; i++) c[((0x8ba0 - i * 0x20) - 0x8800) & 0x3ff] = 0x02;
  for (let i = 0; i < 9; i++) c[((0x8940 - i * 0x20) - 0x8800) & 0x3ff] = 0x02;
  for (let i = 0; i < 10; i++) c[((0x8a80 - i * 0x20) - 0x8800) & 0x3ff] = 0x03;
  return c;
}
const EXP_VIDEO = expectVideo();
const EXP_COLOR = expectColor();

// -- minimal machine: real mem/io/regs + the step/ret seam -------------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x46f4;
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
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(fn) {
  const m = new TestMachine(buildRom());
  m.push16(SENTINEL); // the caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    video: m.mem.videoRam.slice(),
    color: m.mem.colorRam.slice(),
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    de: m.regs.de,
    hl: m.regs.hl,
    ix: m.regs.ix,
  };
}

// Full spec assertion, factored so the mutant runs through the same checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");
  assert.deepEqual(res.video, EXP_VIDEO, "video RAM column copy");
  assert.deepEqual(res.color, EXP_COLOR, "colour RAM fills");
  assert.equal(res.pc, SENTINEL, "ret lands on caller");
  assert.equal(res.sp, 0x8780, "stack balanced");
  assert.equal(res.ix, 0x4acb, "IX advanced past the 32-byte source strip");
  assert.equal(res.hl, 0x8940, "HL = last colour cursor (0x8A80 - 10*0x20)");
  assert.equal(res.de, 0xffe0, "DE unchanged");
  assert.equal(res.a, 0x03, "A = last fill colour");
  assert.equal(res.b, 0x00, "B counted down to 0");
}

test("loc_46f4: draws the left column + three colour fills, 2894 T", () => {
  checkSpec(run(loc_46f4));
});

// The first video write lands at the BOTTOM of the column (0x9000) and the last
// at the TOP (0x93E0): pin the direction so a stride sign-flip can't hide.
test("loc_46f4: column is walked UP (stride -0x20), first tile at 0x9000", () => {
  const res = run(loc_46f4);
  assert.equal(res.video[(0x9000 - 0x9000) & 0x3ff], srcByte(31), "top-of-loop last write? no -- bottom addr gets tile 31");
  assert.equal(res.video[(0x93e0 - 0x9000) & 0x3ff], srcByte(0), "0x93E0 gets tile 0 (first write)");
});

// -- MUTATION: inc ix -> dec ix in loop 1. The source strip is then read
// BACKWARDS (0x4AAB, 0x4AAA, ...), so the copied tiles are wrong AND IX ends at
// 0x4A8B instead of 0x4ACB. Cycles are unchanged, so the memory/register checks
// are what must catch it.
function loc_46f4_mutant(m) {
  const { regs, mem } = m;
  regs.ix = 0x4aab;
  m.step(0x46f8, 14);
  regs.hl = 0x93e0;
  m.step(0x46fb, 10);
  regs.de = 0xffe0;
  m.step(0x46fe, 10);
  regs.b = 0x20;
  m.step(0x4700, 7);
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x4703, 19);
    mem.write8(regs.hl, regs.a);
    m.step(0x4704, 7);
    regs.addHl(regs.de);
    m.step(0x4705, 11);
    regs.ix = (regs.ix - 1) & 0xffff; // BUG: should be +1
    m.step(0x4707, 10);
    if (regs.djnz() !== 0) {
      m.step(0x4700, 13);
    } else {
      m.step(0x4709, 8);
      break;
    }
  }
  regs.hl = 0x8ba0;
  m.step(0x470c, 10);
  regs.de = 0xffe0;
  m.step(0x470f, 10);
  regs.a = 0x02;
  m.step(0x4711, 7);
  regs.b = 0x09;
  m.step(0x4713, 7);
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x4714, 7);
    regs.addHl(regs.de);
    m.step(0x4715, 11);
    if (regs.djnz() !== 0) {
      m.step(0x4713, 13);
    } else {
      m.step(0x4717, 8);
      break;
    }
  }
  regs.hl = 0x8940;
  m.step(0x471a, 10);
  regs.b = 0x09;
  m.step(0x471c, 7);
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x471d, 7);
    regs.addHl(regs.de);
    m.step(0x471e, 11);
    if (regs.djnz() !== 0) {
      m.step(0x471c, 13);
    } else {
      m.step(0x4720, 8);
      break;
    }
  }
  regs.hl = 0x8a80;
  m.step(0x4723, 10);
  regs.a = 0x03;
  m.step(0x4725, 7);
  regs.b = 0x0a;
  m.step(0x4727, 7);
  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x4728, 7);
    regs.addHl(regs.de);
    m.step(0x4729, 11);
    if (regs.djnz() !== 0) {
      m.step(0x4727, 13);
    } else {
      m.step(0x472b, 8);
      break;
    }
  }
  m.ret();
}

test("mutation (inc ix -> dec ix) is caught by the spec", () => {
  const bad = run(loc_46f4_mutant);
  // Sanity: the mutant really diverges -- wrong tiles copied and IX off.
  assert.notDeepEqual(bad.video, EXP_VIDEO, "mutant copied the strip backwards");
  assert.equal(bad.ix, 0x4a8b, "mutant IX walked the wrong way");
  assert.equal(bad.cycles, EXP_CYCLES, "cycles unchanged -- only memory/regs catch it");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
