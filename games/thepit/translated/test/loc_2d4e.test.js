// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_2d4e (ROM 0x2d4e-0x2d6a), The Pit.
//
// loc_2d4e is the "matched tile" arm of the object scanner at 0x2d28..0x2d4b: once the
// tilemap cell under IX (from 0x80af, inside video RAM) holds tile 0x2a/0x2b/0x41 it
// requests sound 0x11 (call 0x4c93), stamps tile 0x41 into the adjacent cell (ix-0x1f),
// clears 0x80bd/0x80a9, seeds 0x80aa=0x09 / 0x80ab=0x07, then TAIL-JUMPS to 0x2bd3.
//
// It is one straight line -- no conditional branches -- so there is a single path.
// The call seam is stubbed as in the loc_2cb7 drafter: the stub records the target and
// models a bare `ret` (pop -> pc). The REGULAR call 0x4c93 pushes 0x2d51, so its stub
// pops that; the final `jp 0x2bd3` pushed nothing, so its stub pops the SENTINEL and pc
// ends at the caller. The stub charges no callee cycles, so the total is loc_2d4e's OWN
// cost = 126 T.
//
// Mutation: the `ld (ix-0x1f),a` displacement is flipped to (ix+0x1f) (wrong sign) --
// the spec catches it because the stamp lands at the wrong VRAM cell (ix-0x1f stays 0).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_2d4e } from "../loc_2d4e.js";

const CALL_SOUND = 0x4c93; // regular call: request sound 0x11
const TAIL = 0x2bd3; // closing tail-jump target
const SENTINEL = 0xbeef; // caller return address the tail-callee's ret lands on
const SP0 = 0x8780; // SP inside work RAM so pushes/pops are mapped
const IX0 = 0x9080; // IX into video RAM (as loaded from 0x80af upstream)
const STAMP_CELL = (IX0 - 0x1f) & 0xffff; // 0x9061 -- where tile 0x41 is written
const WRONG_CELL = (IX0 + 0x1f) & 0xffff; // 0x909f -- where the sign-flip mutant writes

function buildRom() {
  return new Uint8Array(0x5000); // AddressSpace requires a 20480-byte ROM; contents unused
}

// Minimal machine: real mem/io/regs + the step/call/push16 seam. The call stub records the
// target and models a bare `ret` (pop -> pc). loc_2d4e has no register-returning calls.
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x2d4e;
    this.calls = [];
    this.regs.sp = SP0;
    this.regs.ix = IX0;
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
    this.pc = this.pop16(); // bare ret: pop the (just-pushed, or caller's) return address
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(routine) {
  const m = new TestMachine(buildRom());
  m.push16(SENTINEL); // the caller's return address
  routine(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    stamp: m.mem.read8(STAMP_CELL),
    wrong: m.mem.read8(WRONG_CELL),
    b80bd: m.mem.read8(0x80bd),
    b80a9: m.mem.read8(0x80a9),
    b80aa: m.mem.read8(0x80aa),
    b80ab: m.mem.read8(0x80ab),
  };
}

// The one straight-line spec, asserted as a function so the mutation can reuse it.
//   call(17) + ld a(7) + ld(ix-d),a(19) + ld a(7) + ld(13) + ld(13) + ld a(7)
//   + ld(13) + ld a(7) + ld(13) + jp(10) = 126 T
function spec(r) {
  assert.equal(r.cycles, 126, "straight-line path is 126 T");
  assert.deepEqual(r.calls, [CALL_SOUND, TAIL], "regular call 0x4c93 then tail-jump 0x2bd3");
  assert.equal(r.pc, SENTINEL, "0x2bd3's ret returns to loc_2d4e's caller");
  assert.equal(r.sp, SP0, "stack balanced (call pushed+popped, tail-jump popped the sentinel)");
  assert.equal(r.stamp, 0x41, "tile 0x41 stamped into (ix-0x1f) = 0x9061");
  assert.equal(r.b80bd, 0x00, "0x80bd cleared");
  assert.equal(r.b80a9, 0x00, "0x80a9 cleared");
  assert.equal(r.b80aa, 0x09, "0x80aa seeded to 0x09");
  assert.equal(r.b80ab, 0x07, "0x80ab seeded to 0x07");
  assert.equal(r.a, 0x07, "A holds the last immediate (0x07) at exit");
}

test("loc_2d4e: match arm -- sound 0x11, stamp tile 0x41 @ (ix-0x1f), seed block, jp 0x2bd3, 126 T", () => {
  spec(run(loc_2d4e));
});

// ============================================================================
// MUTATION: flip the `ld (ix-0x1f),a` displacement sign to (ix+0x1f). The stamp now
// lands at 0x909f instead of 0x9061, so the spec's `stamp == 0x41` assertion fails and
// (ix-0x1f) stays 0 -- a wrong-cell write the spec must catch.
// ============================================================================
function loc_2d4e_mutant(m) {
  const { regs, mem } = m;
  m.push16(0x2d51);
  m.step(0x4c93, 17);
  m.call(0x4c93);
  regs.a = 0x41;
  m.step(0x2d53, 7);
  mem.write8((regs.ix + 0x1f) & 0xffff, regs.a); // BUG: real is (ix-0x1f)
  m.step(0x2d56, 19);
  regs.a = 0x00;
  m.step(0x2d58, 7);
  mem.write8(0x80bd, regs.a);
  m.step(0x2d5b, 13);
  mem.write8(0x80a9, regs.a);
  m.step(0x2d5e, 13);
  regs.a = 0x09;
  m.step(0x2d60, 7);
  mem.write8(0x80aa, regs.a);
  m.step(0x2d63, 13);
  regs.a = 0x07;
  m.step(0x2d65, 7);
  mem.write8(0x80ab, regs.a);
  m.step(0x2d68, 13);
  m.step(0x2bd3, 10);
  return m.call(0x2bd3);
}

test("mutation ((ix-0x1f) -> (ix+0x1f)) is caught by the spec", () => {
  const bad = run(loc_2d4e_mutant);
  assert.equal(bad.stamp, 0x00, "mutant leaves (ix-0x1f) unwritten");
  assert.equal(bad.wrong, 0x41, "mutant stamps the wrong cell (ix+0x1f)");
  assert.throws(() => spec(bad), "the spec rejects the flipped-displacement mutant");
});
