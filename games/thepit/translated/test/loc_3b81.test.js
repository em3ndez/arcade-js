// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_3b81 (ROM 0x3b81-0x3ba7), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake
// ROM (the copyrighted image is never committed). Callees (0x4b44, 0x4bff) are
// stubbed as trivial "pop-and-return" routines that balance the stack but add no
// cycles, so the asserted T-state total is loc_3b81's OWN instruction cost.
//
// The mutation is a CYCLE-ONLY break (djnz taken charged 12 instead of 13). It
// moves no memory -- the video/colour diffs are byte-identical -- so ONLY the
// T-state assertion catches it. That is the whole point of charging cycles
// (docs/03-translation.md): a timing error invisible to the state diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3b81 } from "../loc_3b81.js";

// -- seeded ROM: one distinct 0x400-byte tilemap source at 0x3e32 --------------
const SRC = 0x3e32; // tilemap source copied to video RAM
const LEN = 0x0400;
const FILL = 0x93; // colour attribute flooded across 0x8800-0x8BFF

const pat = (i) => (i * 3 + 1) & 0xff;

function buildRom() {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  for (let i = 0; i < LEN; i++) rom[SRC + i] = pat(i);
  return rom;
}

const EXP_VIDEO = (() => {
  const a = new Uint8Array(LEN);
  for (let i = 0; i < LEN; i++) a[i] = pat(i);
  return a;
})();
const EXP_COLOR = new Uint8Array(LEN).fill(FILL);

const SENTINEL = 0xbeef; // return address the tail-jump's callee `ret` must land on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// -- T-state accounting (own instruction cost; stubbed callees add 0) ---------
//   prologue: call+ld+call+3*ld16+ldir(0x400)+ld16+ld+ld16
const LDIR = 21 * (LEN - 1) + 16; // 21499
const PROLOGUE = 17 + 7 + 17 + 10 + 10 + 10 + LDIR + 10 + 7 + 10; // 21597
//   loop: 4 outer passes. inner = 256*(ld(de),a=7 + inc de=6) + djnz(255*13 + 1*8)
const INNER = 256 * (7 + 6) + (255 * 13 + 8); // 6651
const LOOP = 4 * (INNER + 4 /*dec c*/) + (3 * 12 + 7); /*jr nz: 3 taken, 1 not*/ // 26663
const EPILOGUE = 7 /*ld a,0xa0*/ + 10; /*jp 0x4bff*/ // 17
const EXP_CYCLES = PROLOGUE + LOOP + EPILOGUE; // 48277

// -- minimal machine: real mem/io/regs + the step/call/ldir seam -------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3b81;
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address the
  // CALL/JP left on the stack). No cycle charge -- the callee's cost is not ours.
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
  const m = new TestMachine(buildRom());
  m.push16(SENTINEL); // the caller's return address (consumed by the tail-jump's ret)
  fn(m);
  return {
    cycles: m.cycles,
    video: m.mem.videoRam.slice(),
    color: m.mem.colorRam.slice(),
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    c: m.regs.c,
    de: m.regs.de,
    hl: m.regs.hl,
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");
  assert.deepEqual(res.video, EXP_VIDEO, "tilemap copied to video RAM");
  assert.deepEqual(res.color, EXP_COLOR, "colour RAM flooded with 0x93");
  assert.deepEqual(res.calls, [0x4b44, 0x4bff, 0x4bff], "call sequence (2 setup + tail)");
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
  assert.equal(res.a, 0xa0, "A = 0xA0 into the tail-jump");
  assert.equal(res.b, 0x00, "B wrapped back to 0");
  assert.equal(res.c, 0x00, "C counted down to 0");
  assert.equal(res.de, 0x8c00, "DE past the 0x400-byte colour fill");
  assert.equal(res.hl, 0x4232, "HL past the tilemap source after ldir");
}

test("loc_3b81: copies tilemap, floods colour, tail-jumps 0x4bff; 48277 T", () => {
  checkSpec(run(loc_3b81));
});

// -- MUTATION: charge the taken djnz 12 T instead of 13. Moves NO memory, so the
// video/colour diffs stay green -- only the T-state total (255*4 = 1020 T short)
// exposes it. Proves the cycle assertion earns its keep.
function loc_3b81_mutant(m) {
  const { regs, mem } = m;
  m.push16(0x3b84);
  m.step(0x4b44, 17);
  m.call(0x4b44);
  regs.a = 0x01;
  m.step(0x3b86, 7);
  m.push16(0x3b89);
  m.step(0x4bff, 17);
  m.call(0x4bff);
  regs.de = 0x9000;
  m.step(0x3b8c, 10);
  regs.hl = 0x3e32;
  m.step(0x3b8f, 10);
  regs.bc = 0x0400;
  m.step(0x3b92, 10);
  m.ldirAt(0x3b92, 0x3b94);
  regs.de = 0x8800;
  m.step(0x3b97, 10);
  regs.a = 0x93;
  m.step(0x3b99, 7);
  regs.bc = 0x0004;
  m.step(0x3b9c, 10);
  for (;;) {
    for (;;) {
      mem.write8(regs.de, regs.a);
      m.step(0x3b9d, 7);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x3b9e, 6);
      if (regs.djnz() !== 0) {
        m.step(0x3b9c, 12); // BUG: djnz taken is 13 T, not 12
      } else {
        m.step(0x3ba0, 8);
        break;
      }
    }
    regs.c = regs.dec8(regs.c);
    m.step(0x3ba1, 4);
    if (regs.fNZ) {
      m.step(0x3b9c, 12);
    } else {
      m.step(0x3ba3, 7);
      break;
    }
  }
  regs.a = 0xa0;
  m.step(0x3ba5, 7);
  m.step(0x4bff, 10);
  return m.call(0x4bff);
}

test("mutation (djnz taken mischarged 12 T) is caught by the cycle assertion", () => {
  const bad = run(loc_3b81_mutant);
  // Memory is byte-identical -- a state-only diff would MISS this.
  assert.deepEqual(bad.video, EXP_VIDEO, "video RAM identical to the correct run");
  assert.deepEqual(bad.color, EXP_COLOR, "colour RAM identical to the correct run");
  // 4 passes * 255 taken djnz, each 1 T short = 1020 T under the true total.
  assert.equal(bad.cycles, EXP_CYCLES - 1020, "mutant is exactly 1020 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
