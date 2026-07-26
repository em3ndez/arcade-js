// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_38c8 (ROM 0x38c8-0x3944): the respawn/reset branch of a
// left-marching actor. Two control paths forked on X (0x810a) by `cp 0x80`:
//   A) X <  0x80  -> jp nc NOT taken -> full RE-INIT of the object, then `ret`
//   B) X >= 0x80  -> jp nc taken     -> TAIL-jump loc_3945 (per-frame move path)
// Path A asserts the exact T-state total, the instruction-boundary step
// sequence, that it RETURNED (no tail-jump), the final PC and A, and every
// work / video / colour RAM byte written -- including the eight-cell tile stamp
// 0xb8..0xbf (A bumped by `inc a` between pairs) and the eight colour cells all
// 0x97. Path B asserts the tail-jump target, no ret, no writes, and A unchanged.
// Then a cycle-NEUTRAL MUTATION (`ld a,0xb8` -> `ld a,0xb9`, still 7T) shifts all
// eight stamped tiles by one; only the video-RAM value assertions reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_38c8 } from "../loc_38c8.js";

// Leaf-routine machine double: real regs/mem/io + the step/call/ret seam.
// `step` records its target + charges cycles. `call` records the target and
// returns undefined -- for a tail-jump `return m.call(addr)` this models
// "control transferred there and never came back". `ret` records that the
// routine returned to its caller (path A's terminal `ret`).
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x38c8,
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
  assert.deepEqual(m.calls, exp.calls ?? [], "call / tail-jump targets");
  assert.deepEqual(m.pushes, exp.pushes ?? [], "call return-address pushes");
  assert.equal(m.returned, exp.returned, "returned (direct ret) vs tail-jump");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// Path A step targets: from cp (0x38cb) through the last stamp store (0x3944).
// The terminal `ret` charges via m.ret, not m.step, so 0x3944 is the last step.
const REINIT_STEPS = [
  0x38cb, 0x38cd, 0x38d0, 0x38d2, 0x38d5, 0x38d7, 0x38da, 0x38dc, 0x38df, 0x38e2,
  0x38e4, 0x38e7, 0x38e9, 0x38ec, 0x38ee, 0x38f1, 0x38f3, 0x38f6, 0x38f9, 0x38fb,
  0x38fe, 0x3901, 0x3905, 0x3909, 0x390b, 0x390d, 0x3910, 0x3913, 0x3914, 0x3917,
  0x391a, 0x391b, 0x391e, 0x3921, 0x3922, 0x3925, 0x3928, 0x3929, 0x392c, 0x392f,
  0x3930, 0x3933, 0x3936, 0x3937, 0x393a, 0x393d, 0x393e, 0x3941, 0x3944,
];

// Path A T-states, built from the instruction stream:
//   preamble (not taken): ld a,(nn) 13 + cp n 7 + jp cc 10
//   scalar block 0x38d0-0x38fe: 8*ld a,n(7)/add(7) [56] + 11*ld (nn),a(13) [143]
//   stamp setup: ld ix 14 + ld iy 14 + ld b,n 7 + ld a,n 7
//   stamp: 16*ld (ix|iy+d)(19) [304] + 7*inc a(4) [28]
//   ret 10
const REINIT_CYCLES =
  13 + 7 + 10 + (56 + 143) + (14 + 14 + 7 + 7) + (16 * 19 + 7 * 4) + 10; // = 613

// The full set of bytes the re-init writes. Tile stamp uses codes 0xb8..0xbf.
function reinitMem() {
  return {
    // primary object + twin mirror fields (work RAM)
    0x810a: 0xf0, 0x811b: 0x00, // X := 0xf0, mirror := 0x00 (0xf0+0x10 wraps)
    0x810d: 0x1f, 0x811e: 0x1f, // Y + twin mirror
    0x811c: 0x2a, 0x810b: 0x2b, // twin tile, primary tile
    0x810e: 0x00, 0x810f: 0x01, // fields
    0x8112: 0x01,               // timer
    0x810c: 0x93, 0x811d: 0x93, // (same A = 0x93)
    // video-RAM stamp at IX=0x93a3 + {-0x20,-0x1f,0,+1,-0x60,-0x5f,-0x40,-0x3f},
    // tile codes 0xb8..0xbf in that write order:
    0x9383: 0xb8, 0x9384: 0xb9, 0x93a3: 0xba, 0x93a4: 0xbb,
    0x9343: 0xbc, 0x9344: 0xbd, 0x9363: 0xbe, 0x9364: 0xbf,
    // colour-RAM stamp at IY=0x8ba3 + same offsets, all colour byte 0x97 (B):
    0x8b83: 0x97, 0x8b84: 0x97, 0x8ba3: 0x97, 0x8ba4: 0x97,
    0x8b43: 0x97, 0x8b44: 0x97, 0x8b63: 0x97, 0x8b64: 0x97,
  };
}

// --- Path A: X < 0x80 -> jp nc NOT taken -> full re-init, then ret ------------
test("path A: X < 0x80 -> full re-init and direct ret", () => {
  const m = makeMachine({ 0x810a: 0x40 });
  loc_38c8(m);
  assertPath(m, {
    steps: REINIT_STEPS,
    calls: [],           // no call, no tail-jump -- it rets
    pushes: [],
    returned: true,
    cycles: REINIT_CYCLES, // 613
    pc: 0x3944,            // last step target; ret does not move PC in the stub
    a: 0xbf,              // last inc a leaves A = 0xbf (the 8th tile code)
    mem: reinitMem(),
  });
  assert.equal(m.regs.b, 0x97, "B = colour byte held across the stamp");
  assert.equal(m.regs.ix, 0x93a3, "IX = video RAM cursor");
  assert.equal(m.regs.iy, 0x8ba3, "IY = colour RAM cursor");
});

// --- Path B: X >= 0x80 -> jp nc taken -> tail-jump loc_3945 -------------------
test("path B: X >= 0x80 -> tail-jump 0x3945 (move path)", () => {
  const m = makeMachine({ 0x810a: 0x80 });
  loc_38c8(m);
  assertPath(m, {
    steps: [0x38cb, 0x38cd, 0x3945],
    calls: [0x3945],     // tail-jump; loc_3945's ret unwinds to our caller
    pushes: [],
    returned: false,     // no direct ret on this path
    cycles: 13 + 7 + 10, // 30
    pc: 0x3945,
    a: 0x80,             // cp does not alter A
    mem: { 0x810a: 0x80, 0x810b: 0x00 }, // X untouched; re-init fields not written
  });
});

// Boundary check: 0x7f takes the re-init path (0x7f < 0x80 -> carry -> NC false).
test("boundary: X = 0x7f still re-inits (carry set by cp 0x80)", () => {
  const m = makeMachine({ 0x810a: 0x7f });
  loc_38c8(m);
  assert.equal(m.returned, true, "0x7f < 0x80 -> re-init + ret");
  assert.equal(m.calls.length, 0, "no tail-jump on the re-init path");
  assert.equal(m.mem.read8(0x810a), 0xf0, "X reset to 0xf0");
});

// --- Mutation: first stamp tile 0xb8 -> 0xb9 (cycle-neutral) ------------------
// Byte-identical to loc_38c8 except `ld a,0xb8` (0x390b) becomes `ld a,0xb9`, so
// every stamped tile shifts up by one (0xb9..0xc0). `ld a,n` is 7T either way,
// so the cycle total is UNCHANGED (613) -- only the video-RAM value assertions
// can reject it.
test("mutation: wrong first tile (0xb9) is caught by the video-RAM values", () => {
  function loc_38c8_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x810a); m.step(0x38cb, 13);
    regs.cp(0x80); m.step(0x38cd, 7);
    if (regs.fNC) { m.step(0x3945, 10); return m.call(0x3945); }
    m.step(0x38d0, 10);
    regs.a = 0xf0; m.step(0x38d2, 7);
    mem.write8(0x810a, regs.a); m.step(0x38d5, 13);
    regs.add(0x10); m.step(0x38d7, 7);
    mem.write8(0x811b, regs.a); m.step(0x38da, 13);
    regs.a = 0x1f; m.step(0x38dc, 7);
    mem.write8(0x810d, regs.a); m.step(0x38df, 13);
    mem.write8(0x811e, regs.a); m.step(0x38e2, 13);
    regs.a = 0x2a; m.step(0x38e4, 7);
    mem.write8(0x811c, regs.a); m.step(0x38e7, 13);
    regs.a = 0x2b; m.step(0x38e9, 7);
    mem.write8(0x810b, regs.a); m.step(0x38ec, 13);
    regs.a = 0x00; m.step(0x38ee, 7);
    mem.write8(0x810e, regs.a); m.step(0x38f1, 13);
    regs.a = 0x01; m.step(0x38f3, 7);
    mem.write8(0x810f, regs.a); m.step(0x38f6, 13);
    mem.write8(0x8112, regs.a); m.step(0x38f9, 13);
    regs.a = 0x93; m.step(0x38fb, 7);
    mem.write8(0x810c, regs.a); m.step(0x38fe, 13);
    mem.write8(0x811d, regs.a); m.step(0x3901, 13);
    regs.ix = 0x93a3; m.step(0x3905, 14);
    regs.iy = 0x8ba3; m.step(0x3909, 14);
    regs.b = 0x97; m.step(0x390b, 7);
    regs.a = 0xb9; m.step(0x390d, 7); // BUG: first tile should be 0xb8
    mem.write8((regs.ix - 0x20) & 0xffff, regs.a); m.step(0x3910, 19);
    mem.write8((regs.iy - 0x20) & 0xffff, regs.b); m.step(0x3913, 19);
    regs.a = regs.inc8(regs.a); m.step(0x3914, 4);
    mem.write8((regs.ix - 0x1f) & 0xffff, regs.a); m.step(0x3917, 19);
    mem.write8((regs.iy - 0x1f) & 0xffff, regs.b); m.step(0x391a, 19);
    regs.a = regs.inc8(regs.a); m.step(0x391b, 4);
    mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x391e, 19);
    mem.write8((regs.iy + 0x00) & 0xffff, regs.b); m.step(0x3921, 19);
    regs.a = regs.inc8(regs.a); m.step(0x3922, 4);
    mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x3925, 19);
    mem.write8((regs.iy + 0x01) & 0xffff, regs.b); m.step(0x3928, 19);
    regs.a = regs.inc8(regs.a); m.step(0x3929, 4);
    mem.write8((regs.ix - 0x60) & 0xffff, regs.a); m.step(0x392c, 19);
    mem.write8((regs.iy - 0x60) & 0xffff, regs.b); m.step(0x392f, 19);
    regs.a = regs.inc8(regs.a); m.step(0x3930, 4);
    mem.write8((regs.ix - 0x5f) & 0xffff, regs.a); m.step(0x3933, 19);
    mem.write8((regs.iy - 0x5f) & 0xffff, regs.b); m.step(0x3936, 19);
    regs.a = regs.inc8(regs.a); m.step(0x3937, 4);
    mem.write8((regs.ix - 0x40) & 0xffff, regs.a); m.step(0x393a, 19);
    mem.write8((regs.iy - 0x40) & 0xffff, regs.b); m.step(0x393d, 19);
    regs.a = regs.inc8(regs.a); m.step(0x393e, 4);
    mem.write8((regs.ix - 0x3f) & 0xffff, regs.a); m.step(0x3941, 19);
    mem.write8((regs.iy - 0x3f) & 0xffff, regs.b); m.step(0x3944, 19);
    return m.ret();
  }

  const m = makeMachine({ 0x810a: 0x40 });
  loc_38c8_mutant(m);
  // Cycles match the real Path A, so cycles alone cannot catch it.
  assert.equal(m.cycles, REINIT_CYCLES, "mutation preserves the cycle total");
  assert.equal(m.mem.read8(0x9383), 0xb9, "mutant stamped the wrong first tile");
  // Set the expected A to the mutant's own final value (0xc0) so the A check
  // passes; the correct-routine expectation is then rejected specifically by a
  // video-RAM value assertion -- proving those checks, not cycles, catch it.
  assert.throws(
    () => assertPath(m, {
      steps: REINIT_STEPS,
      calls: [],
      pushes: [],
      returned: true,
      cycles: REINIT_CYCLES,
      pc: 0x3944,
      a: 0xc0, // mutant's final A (0xb9 + 7 inc = 0xc0)
      mem: reinitMem(),
    }),
    /mem\[0x93[0-9a-f]{2}\]/, // a video-RAM tile cell (all eight are 0x93xx)
  );
});
