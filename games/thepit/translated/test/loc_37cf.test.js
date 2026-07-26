// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_37cf (ROM 0x37cf-0x3849): the alt-phase actor spawn/init,
// tail-reached from loc_3748 when (0x807b) != 0. Three control paths:
//   A) (0x807b) == 0xff        -> tail-jump loc_384a (no init)
//   B) (0x807b) == 2           -> init with Y = 0x16 (jr z,0x37dc TAKEN)
//   C) (0x807b) == anything else (5) -> init with Y = 0x17 (jr z,0x37dc NOT taken)
// Each asserts the exact T-state total, the instruction-boundary step sequence,
// the control-flow (mid-routine `call 0x4c6b` recorded, tail target via `calls`,
// no ret), the final PC and A, and every work / video / colour RAM byte written.
// Then a MUTATION swaps the stamped tile byte 0x24 -> 0x25; cycles are UNCHANGED
// (ld a,n is 7T either way), so only the video-RAM value assertions reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_37cf } from "../loc_37cf.js";

// Leaf-routine machine double: real regs/mem/io + the step/call/push16 seam.
// `step` records its target + charges cycles. `call` records the target and
// returns undefined -- for the MID-routine call 0x4c6b control naturally
// resumes in loc_37cf; for the tail-jumps `return m.call(addr)` models "control
// transferred there and never came back". `push16` records the pushed return
// address WITHOUT touching the (unmapped, SP=0) stack.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x37cf,
    steps: [],
    calls: [],
    pushes: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined;
    },
    push16(v) {
      this.pushes.push(v);
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call / tail-jump targets");
  assert.deepEqual(m.pushes, exp.pushes ?? [], "call return-address pushes");
  assert.equal(m.returned, false, "no ret -- every exit is a tail-jump");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// Common init tail: step targets from ld (0x810d),a (0x37df) through jp 0x3a4c.
const BODY_STEPS = [
  0x37df, 0x37e2, 0x37e4, 0x37e7, 0x4c6b, 0x37ec, 0x37ef, 0x37f1, 0x37f4, 0x37f6,
  0x37f9, 0x37fb, 0x37fe, 0x3800, 0x3803, 0x3805, 0x3808, 0x380b, 0x380f, 0x3813,
  0x3815, 0x3817, 0x381a, 0x381d, 0x3820, 0x3823, 0x3826, 0x3829, 0x382c, 0x382f,
  0x3832, 0x3835, 0x3838, 0x383b, 0x383e, 0x3841, 0x3844, 0x3847, 0x3a4c,
];
// T-states for that tail: 4 stores(13)+ld a,ff(7)+store(13)+call(17)+ld a(7)+
// store(13)+add(7)+store(13) ... ld ix/iy(14,14) + ld b/a(7,7) + 16*19 + jp(10).
const BODY_CYCLES =
  13 + 13 + 7 + 13 + 17 + 7 + 13 + 7 + 13 + 7 + 13 + 7 + 13 + 7 + 13 + 7 + 13 + 13 +
  14 + 14 + 7 + 7 + 16 * 19 + 10; // = 552

// The init writes shared by paths B and C (Y supplied per-path).
function initMem(y) {
  return {
    0x807b: 0xff, // alt-phase marked active
    0x810d: y, 0x811e: y, // primary Y + twin mirror
    0x810a: 0x10, 0x811b: 0x20, // primary X + mirror (0x10 + 0x10)
    0x810b: 0x2e, 0x811c: 0x2f, // primary + twin tile
    0x8112: 0x01, // timer
    0x810c: 0x97, 0x811d: 0x97,
    // video RAM stamp (tile 0x24) at IX=0x93a3 + {-0x20,-0x1f,0,+1,-0x60,-0x5f,-0x40,-0x3f}
    0x9383: 0x24, 0x9384: 0x24, 0x93a3: 0x24, 0x93a4: 0x24,
    0x9343: 0x24, 0x9344: 0x24, 0x9363: 0x24, 0x9364: 0x24,
    // colour RAM stamp (colour 0x90) at IY=0x8ba3 + same offsets
    0x8b83: 0x90, 0x8b84: 0x90, 0x8ba3: 0x90, 0x8ba4: 0x90,
    0x8b43: 0x90, 0x8b44: 0x90, 0x8b63: 0x90, 0x8b64: 0x90,
  };
}

// --- Path A: (0x807b) == 0xff -> inc a wraps to 0, Z set -> tail 0x384a --------
test("path A: alt-phase already active (0xff) -> tail-jump 0x384a", () => {
  const m = makeMachine({ 0x807b: 0xff });
  loc_37cf(m);
  assertPath(m, {
    steps: [0x37d2, 0x37d3, 0x384a],
    calls: [0x384a],
    pushes: [],
    cycles: 13 + 4 + 12, // 29
    pc: 0x384a,
    a: 0x00, // 0xff + 1 = 0x00
    mem: { 0x807b: 0xff }, // untouched -- init path not entered
  });
});

// --- Path B: (0x807b) == 2 -> Y = 0x16 (cp 0x03 sets Z, jr z,0x37dc taken) -----
test("path B: sub-state 2 -> init with Y=0x16, tail-jump 0x3a4c", () => {
  const m = makeMachine({ 0x807b: 0x02 });
  loc_37cf(m);
  assertPath(m, {
    steps: [0x37d2, 0x37d3, 0x37d5, 0x37d7, 0x37d9, 0x37dc, ...BODY_STEPS],
    calls: [0x4c6b, 0x3a4c], // mid-routine sound call, then tail-jump out
    pushes: [0x37ea], // return address pushed by call 0x4c6b
    cycles: 13 + 4 + 7 + 7 + 7 + 12 + BODY_CYCLES, // 50 + 552 = 602
    pc: 0x3a4c,
    a: 0x24, // last ld a,n is 0x24 (the tile byte); the stores don't change A
    mem: initMem(0x16),
  });
  assert.equal(m.regs.b, 0x90, "B = colour byte");
  assert.equal(m.regs.ix, 0x93a3, "IX = video RAM cursor");
  assert.equal(m.regs.iy, 0x8ba3, "IY = colour RAM cursor");
});

// --- Path C: (0x807b) == 5 -> Y = 0x17 (jr z,0x37dc NOT taken -> inc a) --------
test("path C: sub-state 5 -> init with Y=0x17, tail-jump 0x3a4c", () => {
  const m = makeMachine({ 0x807b: 0x05 });
  loc_37cf(m);
  assertPath(m, {
    steps: [0x37d2, 0x37d3, 0x37d5, 0x37d7, 0x37d9, 0x37db, 0x37dc, ...BODY_STEPS],
    calls: [0x4c6b, 0x3a4c],
    pushes: [0x37ea],
    cycles: 13 + 4 + 7 + 7 + 7 + 7 + 4 + BODY_CYCLES, // 49 + 552 = 601
    pc: 0x3a4c,
    a: 0x24,
    mem: initMem(0x17),
  });
});

// --- Mutation: the stamped tile byte 0x24 -> 0x25 ------------------------------
// Byte-identical to loc_37cf except `ld a,0x24` (0x3815) becomes `ld a,0x25`, so
// all eight video-RAM cells get 0x25. `ld a,n` is 7T either way, so the cycle
// total is UNCHANGED (602) -- only the video-RAM value assertions can reject it.
test("mutation: wrong stamped tile (0x25) is caught by the video-RAM values", () => {
  function loc_37cf_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x807b); m.step(0x37d2, 13);
    regs.a = regs.inc8(regs.a); m.step(0x37d3, 4);
    if (regs.fZ) { m.step(0x384a, 12); return m.call(0x384a); }
    m.step(0x37d5, 7);
    regs.cp(0x03); m.step(0x37d7, 7);
    regs.a = 0x16; m.step(0x37d9, 7);
    if (regs.fZ) { m.step(0x37dc, 12); }
    else { m.step(0x37db, 7); regs.a = regs.inc8(regs.a); m.step(0x37dc, 4); }
    mem.write8(0x810d, regs.a); m.step(0x37df, 13);
    mem.write8(0x811e, regs.a); m.step(0x37e2, 13);
    regs.a = 0xff; m.step(0x37e4, 7);
    mem.write8(0x807b, regs.a); m.step(0x37e7, 13);
    m.push16(0x37ea); m.step(0x4c6b, 17); m.call(0x4c6b);
    regs.a = 0x10; m.step(0x37ec, 7);
    mem.write8(0x810a, regs.a); m.step(0x37ef, 13);
    regs.add(0x10); m.step(0x37f1, 7);
    mem.write8(0x811b, regs.a); m.step(0x37f4, 13);
    regs.a = 0x2e; m.step(0x37f6, 7);
    mem.write8(0x810b, regs.a); m.step(0x37f9, 13);
    regs.a = 0x2f; m.step(0x37fb, 7);
    mem.write8(0x811c, regs.a); m.step(0x37fe, 13);
    regs.a = 0x01; m.step(0x3800, 7);
    mem.write8(0x8112, regs.a); m.step(0x3803, 13);
    regs.a = 0x97; m.step(0x3805, 7);
    mem.write8(0x810c, regs.a); m.step(0x3808, 13);
    mem.write8(0x811d, regs.a); m.step(0x380b, 13);
    regs.ix = 0x93a3; m.step(0x380f, 14);
    regs.iy = 0x8ba3; m.step(0x3813, 14);
    regs.b = 0x90; m.step(0x3815, 7);
    regs.a = 0x25; m.step(0x3817, 7); // BUG: tile should be 0x24
    mem.write8((regs.ix - 0x20) & 0xffff, regs.a); m.step(0x381a, 19);
    mem.write8((regs.iy - 0x20) & 0xffff, regs.b); m.step(0x381d, 19);
    mem.write8((regs.ix - 0x1f) & 0xffff, regs.a); m.step(0x3820, 19);
    mem.write8((regs.iy - 0x1f) & 0xffff, regs.b); m.step(0x3823, 19);
    mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x3826, 19);
    mem.write8((regs.iy + 0x00) & 0xffff, regs.b); m.step(0x3829, 19);
    mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x382c, 19);
    mem.write8((regs.iy + 0x01) & 0xffff, regs.b); m.step(0x382f, 19);
    mem.write8((regs.ix - 0x60) & 0xffff, regs.a); m.step(0x3832, 19);
    mem.write8((regs.iy - 0x60) & 0xffff, regs.b); m.step(0x3835, 19);
    mem.write8((regs.ix - 0x5f) & 0xffff, regs.a); m.step(0x3838, 19);
    mem.write8((regs.iy - 0x5f) & 0xffff, regs.b); m.step(0x383b, 19);
    mem.write8((regs.ix - 0x40) & 0xffff, regs.a); m.step(0x383e, 19);
    mem.write8((regs.iy - 0x40) & 0xffff, regs.b); m.step(0x3841, 19);
    mem.write8((regs.ix - 0x3f) & 0xffff, regs.a); m.step(0x3844, 19);
    mem.write8((regs.iy - 0x3f) & 0xffff, regs.b); m.step(0x3847, 19);
    m.step(0x3a4c, 10); return m.call(0x3a4c);
  }

  const m = makeMachine({ 0x807b: 0x02 });
  loc_37cf_mutant(m);
  // Cycles match the real Path B, so cycles alone cannot catch it.
  assert.equal(m.cycles, 13 + 4 + 7 + 7 + 7 + 12 + BODY_CYCLES, "mutation preserves the cycle total");
  assert.equal(m.mem.read8(0x9383), 0x25, "mutant stamped the wrong tile");
  // Set the expected A to the mutant's own value (0x25) so the A-register check
  // passes; the real-routine expectation (0x24) is then rejected specifically by
  // the video-RAM value assertion -- proving those checks, not cycles, catch it.
  assert.throws(
    () => assertPath(m, {
      steps: [0x37d2, 0x37d3, 0x37d5, 0x37d7, 0x37d9, 0x37dc, ...BODY_STEPS],
      calls: [0x4c6b, 0x3a4c],
      pushes: [0x37ea],
      cycles: 13 + 4 + 7 + 7 + 7 + 12 + BODY_CYCLES,
      pc: 0x3a4c,
      a: 0x25,
      mem: initMem(0x16),
    }),
    /mem\[0x93[0-9a-f]{2}\]/, // a video-RAM tile cell (all eight are 0x93xx)
  );
});
