// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated sub_3dea (ROM 0x3dea-0x3e00), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. sub_3dea copies
// B = mem[0x8055] bytes from a DESCENDING IX source into a RAM column starting
// at HL = word[0x8060], stride +0x20, and writes the advanced HL back to 0x8060.
// It makes no calls, so no callee stubs are needed -- only the step/push/pop/ret
// seam.
//
// The mutation is a CYCLE-ONLY break (djnz taken charged 12 instead of 13). It
// moves no memory -- the video-RAM and pointer diffs are byte-identical -- so
// ONLY the T-state assertion catches it. That is the whole point of charging
// cycles (docs/03-translation.md): a timing error invisible to the state diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3dea } from "../sub_3dea.js";

// -- scenario ----------------------------------------------------------------
const N = 4; // loop count at 0x8055
const HL0 = 0x9000; // initial column pointer (video RAM) at word 0x8060
const IX0 = 0x8100; // initial (descending) source pointer, in work RAM
const STRIDE = 0x20;
const SP0 = 0x8780; // SP inside work RAM so pushes are mapped
const SENTINEL = 0xbeef; // caller's return address the final `ret` must land on

// source byte read on iteration k comes from IX0-k; give each a distinct value.
const src = (k) => (0x11 * (k + 1)) & 0xff; // 0x11,0x22,0x33,0x44

// -- expected results --------------------------------------------------------
const EXP_VIDEO = (() => {
  const a = new Uint8Array(0x0400); // 0x9000-0x93FF backing array
  for (let k = 0; k < N; k++) a[k * STRIDE] = src(k);
  return a;
})();
const HL_FINAL = (HL0 + N * STRIDE) & 0xffff; // 0x9080
const IX_FINAL = (IX0 - N) & 0xffff; // 0x80fc

// -- T-state accounting (own instruction cost) -------------------------------
//   prologue: ld a,(nn)=13 + ld b,a=4 + ld hl,(nn)=16 + ld de,nn=10
const PROLOGUE = 13 + 4 + 16 + 10; // 43
//   loop body: ld a,(ix+d)=19 + ld (hl),a=7 + add hl,de=11 + dec ix=10
const BODY = 19 + 7 + 11 + 10; // 47
//   djnz: (N-1) taken * 13 + 1 not-taken * 8
const DJNZ = (N - 1) * 13 + 8; // 47
//   epilogue: ld (nn),hl=16 + ret=10
const EPILOGUE = 16 + 10; // 26
const EXP_CYCLES = PROLOGUE + N * BODY + DJNZ + EPILOGUE; // 304

// -- minimal machine: real mem/io/regs + the step/push/pop/ret seam ----------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3dea;
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
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(fn) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  // Seed inputs into work RAM.
  m.mem.write8(0x8055, N); // loop count
  m.mem.write16(0x8060, HL0); // column pointer
  for (let k = 0; k < N; k++) m.mem.write8((IX0 - k) & 0xffff, src(k)); // source blob
  m.regs.ix = IX0;
  m.push16(SENTINEL); // the caller's return address (consumed by `ret`)
  fn(m);
  return {
    cycles: m.cycles,
    video: m.mem.videoRam.slice(),
    ptrBack: m.mem.read16(0x8060), // advanced HL written back
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    ix: m.regs.ix,
    hl: m.regs.hl,
    de: m.regs.de,
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");
  assert.deepEqual(res.video, EXP_VIDEO, "N bytes copied down the column, stride 0x20");
  assert.equal(res.ptrBack, HL_FINAL, "advanced HL written back to 0x8060");
  assert.equal(res.hl, HL_FINAL, "HL advanced by N*0x20");
  assert.equal(res.ix, IX_FINAL, "IX walked back by N");
  assert.equal(res.a, src(N - 1), "A holds the last source byte read");
  assert.equal(res.b, 0x00, "B counted down to 0");
  assert.equal(res.de, STRIDE, "DE unchanged (the stride)");
  assert.equal(res.pc, SENTINEL, "ret returns to OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
}

test("sub_3dea: copies N bytes down a column (stride 0x20), IX descending; 304 T", () => {
  checkSpec(run(sub_3dea));
});

// -- MUTATION: charge the taken djnz 12 T instead of 13. Moves NO memory, so the
// video-RAM copy and the written-back pointer stay byte-identical -- only the
// T-state total ((N-1)*1 = 3 T short) exposes it. Proves the cycle assertion
// earns its keep.
function sub_3dea_mutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8055);
  m.step(0x3ded, 13);
  regs.b = regs.a;
  m.step(0x3dee, 4);
  regs.hl = mem.read16(0x8060);
  m.step(0x3df1, 16);
  regs.de = 0x0020;
  m.step(0x3df4, 10);
  for (;;) {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x3df7, 19);
    mem.write8(regs.hl, regs.a);
    m.step(0x3df8, 7);
    regs.addHl(regs.de);
    m.step(0x3df9, 11);
    regs.ix = (regs.ix - 1) & 0xffff;
    m.step(0x3dfb, 10);
    if (regs.djnz() !== 0) {
      m.step(0x3df4, 12); // BUG: djnz taken is 13 T, not 12
    } else {
      m.step(0x3dfd, 8);
      break;
    }
  }
  mem.write16(0x8060, regs.hl);
  m.step(0x3e00, 16);
  m.ret();
}

test("mutation (djnz taken mischarged 12 T) is caught by the cycle assertion", () => {
  const bad = run(sub_3dea_mutant);
  // Memory is byte-identical -- a state-only diff would MISS this.
  assert.deepEqual(bad.video, EXP_VIDEO, "video RAM identical to the correct run");
  assert.equal(bad.ptrBack, HL_FINAL, "written-back pointer identical to the correct run");
  // (N-1) taken djnz, each 1 T short.
  assert.equal(bad.cycles, EXP_CYCLES - (N - 1), "mutant is exactly N-1 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
