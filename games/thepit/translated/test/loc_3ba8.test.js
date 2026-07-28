// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_3ba8 (ROM 0x3ba8-0x3bea), The Pit.
//
// loc_3ba8 paints a fixed screen and then SPINS FOREVER (loc_3bdf: the
// `jr 0x3bdf` at 0x3bea is unconditional). The routine never returns, so the
// test drives it and then stops it: the 0x3d7e stub (called once per display-loop
// iteration) throws a sentinel when the loop is about to begin iteration N+1.
// The routine has run its setup ONCE plus N full display-loop iterations at that
// point, and every effect up to there is deterministic and asserted.
//
// Runs on a lightweight machine built from the REAL thepit address space
// (boards/thepit/memory.js) + Io + the shared Z80 Regs, with a seeded fake ROM
// (the copyrighted image is never committed). Callees are stubbed as trivial
// "pop-and-return" routines that balance the stack but add no cycles, so the
// asserted T-state total is loc_3ba8's OWN instruction cost.
//
// The mutation is a CYCLE-ONLY break (the unconditional `jr 0x3bdf` charged 7 T
// instead of 12). It moves no memory -- the video/colour diffs are byte-identical
// -- so ONLY the T-state assertion catches it. That is the whole point of charging
// cycles (docs/translation.md): a timing error invisible to the state diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3ba8 } from "../loc_3ba8.js";

// -- seeded ROM: one distinct 0x400-byte tilemap source at 0x4232 --------------
const SRC = 0x4232; // tilemap source copied to video RAM
const LEN = 0x0400;
const FILL = 0x02; // colour attribute flooded across 0x8800-0x8BFF

const pat = (i) => (i * 7 + 3) & 0xff;

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
// 0x3e1d is stubbed (no-op), so the three colour strips are NOT drawn -- colour
// RAM is exactly the 0x02 flood across the whole 0x400-byte colour map.
const EXP_COLOR = new Uint8Array(LEN).fill(FILL);

const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)
const ITERS = 3; // full display-loop iterations to run before the stub stops it
const STOP = Symbol("stop-display-loop");

// -- T-state accounting (own instruction cost; stubbed callees add 0) ---------
//   prologue: ld a + call + 3*ld16 + ldir(0x400) + ld16 + ld a + ld16
const LDIR = 21 * (LEN - 1) + 16; // 21499
const PROLOGUE = 7 + 17 + 10 + 10 + 10 + LDIR + 10 + 7 + 10; // 21597
//   fill loop: 4 outer passes. inner = 256*(ld(de),a=7 + inc de=6) + djnz(255*13 + 1*8)
const INNER = 256 * (7 + 6) + (255 * 13 + 8); // 6651
const FILL_LOOP = 4 * (INNER + 4 /*dec c*/) + (3 * 12 + 7); /*jr nz: 3 taken, 1 not*/ // 26663
//   three text-strip setups (ld c + ld a + call) + the 0x3d49 setup call
const STRIPS = 3 * (7 + 7 + 17) + 17; // 110
const SETUP = PROLOGUE + FILL_LOOP + STRIPS; // 48353
//   one full display-loop iteration: call 0x3d7e(17) + ld a(7) + call 0x4bff(17)
//   + call 0x4b55(17) + jr 0x3bdf(12)
const ITER = 17 + 7 + 17 + 17 + 12; // 70
//   the stub stops the (ITERS+1)th iteration AT its 0x3d7e call: the CALL fully
//   executed (17 T charged, return address pushed) before the callee faulted.
const PARTIAL = 17;
const EXP_CYCLES = SETUP + ITERS * ITER + PARTIAL; // 48580

// -- minimal machine: real mem/io/regs + the step/call/ldir seam -------------
class TestMachine {
  constructor(rom, jrTaken = 12) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3ba8;
    this.calls = [];
    this.regs.sp = SP0;
    this.d7eCount = 0; // display-loop iteration counter (0x3d7e is the loop head)
    this.jrTaken = jrTaken; // T charged for the unconditional `jr 0x3bdf` (mutant tweaks it)
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
  // CALL left on the stack). No cycle charge -- the callee's cost is not ours.
  // 0x3d7e is the display-loop head: on the (ITERS+1)th call, throw to escape the
  // otherwise-infinite loop BEFORE recording or popping (so calls == setup + ITERS
  // full iterations, and the routine's last push stays unbalanced -> SP = SP0-2).
  call(addr) {
    if (addr === 0x3d7e) {
      this.d7eCount++;
      if (this.d7eCount > ITERS) throw STOP;
    }
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
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
  try {
    fn(m);
    assert.fail("loc_3ba8 must never return -- the stub should have stopped the loop");
  } catch (e) {
    if (e !== STOP) throw e;
  }
  return {
    cycles: m.cycles,
    video: m.mem.videoRam.slice(),
    color: m.mem.colorRam.slice(),
    calls: m.calls,
    sp: m.regs.sp,
    a: m.regs.a,
    b: m.regs.b,
    c: m.regs.c,
    de: m.regs.de,
    hl: m.regs.hl,
  };
}

// setup call order, then ITERS full display-loop iterations of [0x3d7e,0x4bff,0x4b55]
const EXP_CALLS = [0x4bff, 0x3e1d, 0x3e1d, 0x3e1d, 0x3d49];
for (let i = 0; i < ITERS; i++) EXP_CALLS.push(0x3d7e, 0x4bff, 0x4b55);

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total");
  assert.deepEqual(res.video, EXP_VIDEO, "tilemap copied to video RAM");
  assert.deepEqual(res.color, EXP_COLOR, "colour RAM flooded with 0x02");
  assert.deepEqual(res.calls, EXP_CALLS, "setup call order + 3 display-loop iterations");
  assert.equal(res.sp, (SP0 - 2) & 0xffff, "one unbalanced push from the stopped 0x3d7e call");
  assert.equal(res.a, 0x0f, "A = 0x0f, the display loop's ld a,0x0f");
  assert.equal(res.b, 0x00, "B wrapped back to 0 after the colour flood");
  assert.equal(res.c, 0x06, "C = 0x06, the last strip's attribute");
  assert.equal(res.de, 0x8c00, "DE past the 0x400-byte colour fill");
  assert.equal(res.hl, 0x4632, "HL past the tilemap source after ldir");
}

test("loc_3ba8: paints screen, then spins in loc_3bdf forever; 48580 T over 3 loop iters", () => {
  checkSpec(run(loc_3ba8));
});

// -- MUTATION: charge the unconditional `jr 0x3bdf` 7 T instead of 12. Moves NO
// memory -- the video/colour diffs stay green -- so only the T-state total
// (3 iterations * 5 T = 15 T short) exposes it. Proves the cycle assertion earns
// its keep on the loop's signature back-edge.
function loc_3ba8_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x3baa, 7);
  m.push16(0x3bad);
  m.step(0x4bff, 17);
  m.call(0x4bff);
  regs.de = 0x9000;
  m.step(0x3bb0, 10);
  regs.hl = 0x4232;
  m.step(0x3bb3, 10);
  regs.bc = 0x0400;
  m.step(0x3bb6, 10);
  m.ldirAt(0x3bb6, 0x3bb8);
  regs.de = 0x8800;
  m.step(0x3bbb, 10);
  regs.a = 0x02;
  m.step(0x3bbd, 7);
  regs.bc = 0x0004;
  m.step(0x3bc0, 10);
  for (;;) {
    for (;;) {
      mem.write8(regs.de, regs.a);
      m.step(0x3bc1, 7);
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x3bc2, 6);
      if (regs.djnz() !== 0) {
        m.step(0x3bc0, 13);
      } else {
        m.step(0x3bc4, 8);
        break;
      }
    }
    regs.c = regs.dec8(regs.c);
    m.step(0x3bc5, 4);
    if (regs.fNZ) {
      m.step(0x3bc0, 12);
    } else {
      m.step(0x3bc7, 7);
      break;
    }
  }
  regs.c = 0x07;
  m.step(0x3bc9, 7);
  regs.a = 0x12;
  m.step(0x3bcb, 7);
  m.push16(0x3bce);
  m.step(0x3e1d, 17);
  m.call(0x3e1d);
  regs.c = 0x04;
  m.step(0x3bd0, 7);
  regs.a = 0x16;
  m.step(0x3bd2, 7);
  m.push16(0x3bd5);
  m.step(0x3e1d, 17);
  m.call(0x3e1d);
  regs.c = 0x06;
  m.step(0x3bd7, 7);
  regs.a = 0x1a;
  m.step(0x3bd9, 7);
  m.push16(0x3bdc);
  m.step(0x3e1d, 17);
  m.call(0x3e1d);
  m.push16(0x3bdf);
  m.step(0x3d49, 17);
  m.call(0x3d49);
  for (;;) {
    m.push16(0x3be2);
    m.step(0x3d7e, 17);
    m.call(0x3d7e);
    regs.a = 0x0f;
    m.step(0x3be4, 7);
    m.push16(0x3be7);
    m.step(0x4bff, 17);
    m.call(0x4bff);
    m.push16(0x3bea);
    m.step(0x4b55, 17);
    m.call(0x4b55);
    m.step(0x3bdf, 7); // BUG: the unconditional jr is 12 T, not 7
  }
}

test("mutation (jr 0x3bdf mischarged 7 T) is caught by the cycle assertion", () => {
  const bad = run(loc_3ba8_mutant);
  // Memory is byte-identical -- a state-only diff would MISS this.
  assert.deepEqual(bad.video, EXP_VIDEO, "video RAM identical to the correct run");
  assert.deepEqual(bad.color, EXP_COLOR, "colour RAM identical to the correct run");
  // 3 loop iterations * (12 - 7) = 15 T under the true total.
  assert.equal(bad.cycles, EXP_CYCLES - 15, "mutant is exactly 15 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
