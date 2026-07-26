// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_19d0 (ROM 0x19d0-0x19ff, The Pit): the "keep moving"
// continuation of the actor-movement dispatch. It advances the position
// accumulator 0x806b by the per-frame step 0x806d, selects the walk-animation
// frame from bit 1 of the NEW position (0x8069 := 0x34, else 0xb4), and — only
// while feature flag 0x8077 != 0 AND the accumulator has reached >= 0x8a — latches
// 0x807c := 0xb4 and clears 0x8068 := 0x00. Every exit tail-jumps to loc_1b5b.
//
// The test drives THREE control-flow paths (early exit via 0x8077==0 with the
// default frame 0x34; the mid exit via position < 0x8a with the flipped frame
// 0xb4; and the full far-edge one-shot with position >= 0x8a) and asserts each
// path's exact T-state total, instruction-boundary step trace, tail-jump target
// list, final PC (the callee ret lands on a seeded sentinel), SP, the surviving A
// register, and every memory write — including must-NOT-write checks proving the
// one-shot cells 0x807c/0x8068 stay untouched on the two non-edge paths. It then
// re-runs a copy whose DEFAULT frame constant is corrupted 0x34 -> 0x35: a `ld a,n`
// is 7 T either way, so the cycle total is UNCHANGED and only the memory assertion
// on 0x8069 catches it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_19d0 } from "../loc_19d0.js";

const SENTINEL = 0xbeef; // return address the tail-jump's callee `ret` must land on
const RESET_SP = 0x83ff; // initial SP; the tail-jump pops relative to here

// Minimal machine double: the REAL thepit address space + Io + Z80 Regs, plus the
// step/call/push16/ret seam. `call` records the target and behaves as a bare `ret`
// (pops whatever the JP left on the stack) with no cycle charge — the callee's cost
// is not ours. A sentinel is seeded at the stack top so a tail-jump (which pushes
// nothing) lands its callee ret on it.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x19d0,
    steps: [],
    calls: [],
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.cycles += cycles;
      this.steps.push(nextAddr);
    },
    push16(v) {
      this.regs.sp = (this.regs.sp - 2) & 0xffff;
      this.mem.write8(this.regs.sp, v & 0xff);
      this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = this.mem.read8(this.regs.sp);
      const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
      this.regs.sp = (this.regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    call(addr) {
      this.calls.push(addr);
      this.pc = this.pop16(); // bare-ret behaviour; balances a real call's push16
      return undefined;
    },
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.regs.sp = RESET_SP;
  m.mem.write8(RESET_SP, SENTINEL & 0xff);
  m.mem.write8((RESET_SP + 1) & 0xffff, (SENTINEL >> 8) & 0xff);
  if (seed.regs) for (const [r, v] of Object.entries(seed.regs)) m.regs[r] = v;
  if (seed.mem) for (const [a, v] of Object.entries(seed.mem)) m.mem.write8(Number(a), v);
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "tail-jump targets");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC (tail-jump callee ret lands on sentinel)");
  assert.equal(m.regs.sp, (RESET_SP + 2) & 0xffff, "SP = reset top + 2 after one tail pop");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

const PATHS = {
  // Early exit + default frame: step 0x806d=0x01 onto position 0x806b=0x00 -> new
  // 0x01, bit 1 clear -> jr z taken -> frame 0x34. Feature flag 0x8077=0x00 -> and a
  // Z set -> jp z tail to loc_1b5b. The far-edge cells must stay untouched.
  early_exit_frame34: {
    seed: { mem: { 0x806d: 0x01, 0x806b: 0x00, 0x8077: 0x00, 0x807c: 0x11, 0x8068: 0x22 } },
    exp: {
      steps: [
        0x19d3, 0x19d4, 0x19d7, 0x19d8, 0x19db, 0x19dd, 0x19df, 0x19e3, 0x19e6, 0x19e9,
        0x19ea, 0x1b5b,
      ],
      calls: [0x1b5b],
      cycles: 13 + 4 + 13 + 4 + 13 + 7 + 7 + 12 + 13 + 13 + 4 + 10, // 113
      pc: SENTINEL,
      a: 0x00, // A = mem[0x8077] after the `and a` zero-test
      mem: { 0x806b: 0x01, 0x8069: 0x34, 0x807c: 0x11, 0x8068: 0x22 }, // one-shot cells untouched
    },
  },

  // Mid exit + flipped frame: step 0x02 onto 0x00 -> new 0x02, bit 1 set -> jr z NOT
  // taken -> frame 0xb4. Feature 0x8077=0x01 (on) but position 0x02 < 0x8a -> jp c
  // tail to loc_1b5b. Still no far-edge write.
  mid_exit_frameB4: {
    seed: { mem: { 0x806d: 0x02, 0x806b: 0x00, 0x8077: 0x01, 0x807c: 0x11, 0x8068: 0x22 } },
    exp: {
      steps: [
        0x19d3, 0x19d4, 0x19d7, 0x19d8, 0x19db, 0x19dd, 0x19df, 0x19e1, 0x19e3, 0x19e6,
        0x19e9, 0x19ea, 0x19ed, 0x19f0, 0x19f2, 0x1b5b,
      ],
      calls: [0x1b5b],
      cycles: 13 + 4 + 13 + 4 + 13 + 7 + 7 + 7 + 7 + 13 + 13 + 4 + 10 + 13 + 7 + 10, // 145
      pc: SENTINEL,
      a: 0x02, // A = mem[0x806b] reloaded for the cp
      mem: { 0x806b: 0x02, 0x8069: 0xb4, 0x807c: 0x11, 0x8068: 0x22 }, // one-shot cells untouched
    },
  },

  // Far-edge one-shot: step 0x02 onto 0x88 -> new 0x8a, bit 1 set -> frame 0xb4.
  // Feature on, position 0x8a >= 0x8a (cp -> C clear) -> jp c NOT taken -> latch
  // 0x807c=0xb4, clear 0x8068=0x00, jp 0x1b5b.
  far_edge_oneshot: {
    seed: { mem: { 0x806d: 0x02, 0x806b: 0x88, 0x8077: 0x01, 0x807c: 0x11, 0x8068: 0x22 } },
    exp: {
      steps: [
        0x19d3, 0x19d4, 0x19d7, 0x19d8, 0x19db, 0x19dd, 0x19df, 0x19e1, 0x19e3, 0x19e6,
        0x19e9, 0x19ea, 0x19ed, 0x19f0, 0x19f2, 0x19f5, 0x19f7, 0x19fa, 0x19fc, 0x19ff,
        0x1b5b,
      ],
      calls: [0x1b5b],
      cycles:
        13 + 4 + 13 + 4 + 13 + 7 + 7 + 7 + 7 + 13 + 13 + 4 + 10 + 13 + 7 + 10 + 7 + 13 + 7 + 13 + 10, // 195
      pc: SENTINEL,
      a: 0x00, // last load is `ld a,0x00`
      mem: { 0x806b: 0x8a, 0x8069: 0xb4, 0x807c: 0xb4, 0x8068: 0x00 }, // one-shot fired
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_19d0(m);
    assertPath(m, exp);
  });
}

// -- MUTATION: the DEFAULT frame constant 0x34 -> 0x35. A `ld a,n` is 7 T either
// way, so the cycle total is IDENTICAL; only the memory assertion on the latched
// frame 0x8069 (which becomes 0x35) catches it — exactly the kind of value error a
// cycle-only check would miss. Byte-for-byte copy of loc_19d0 with that one change.
function loc_19d0_mutant(m) {
  const { regs, mem } = m;
  blk19e3: {
    regs.a = mem.read8(0x806d);
    m.step(0x19d3, 13);
    regs.e = regs.a;
    m.step(0x19d4, 4);
    regs.a = mem.read8(0x806b);
    m.step(0x19d7, 13);
    regs.add(regs.e);
    m.step(0x19d8, 4);
    mem.write8(0x806b, regs.a);
    m.step(0x19db, 13);
    regs.and(0x02);
    m.step(0x19dd, 7);
    regs.a = 0x35; // BUG: default frame should be 0x34
    m.step(0x19df, 7);
    if (regs.fZ) {
      m.step(0x19e3, 12);
      break blk19e3;
    }
    m.step(0x19e1, 7);
    regs.a = 0xb4;
    m.step(0x19e3, 7);
  }
  mem.write8(0x8069, regs.a);
  m.step(0x19e6, 13);
  regs.a = mem.read8(0x8077);
  m.step(0x19e9, 13);
  regs.and(regs.a);
  m.step(0x19ea, 4);
  if (regs.fZ) {
    m.step(0x1b5b, 10);
    return m.call(0x1b5b);
  }
  m.step(0x19ed, 10);
  regs.a = mem.read8(0x806b);
  m.step(0x19f0, 13);
  regs.cp(0x8a);
  m.step(0x19f2, 7);
  if (regs.fC) {
    m.step(0x1b5b, 10);
    return m.call(0x1b5b);
  }
  m.step(0x19f5, 10);
  regs.a = 0xb4;
  m.step(0x19f7, 7);
  mem.write8(0x807c, regs.a);
  m.step(0x19fa, 13);
  regs.a = 0x00;
  m.step(0x19fc, 7);
  mem.write8(0x8068, regs.a);
  m.step(0x19ff, 13);
  m.step(0x1b5b, 10);
  return m.call(0x1b5b);
}

test("mutation: corrupted default frame constant (0x34 -> 0x35) is caught by memory", () => {
  const good = PATHS.early_exit_frame34;
  const m = makeMachine(good.seed);
  loc_19d0_mutant(m);
  // Cycles are identical to the honest routine (ld a,n is 7 T regardless).
  assert.equal(m.cycles, good.exp.cycles, "mutation preserves the cycle total");
  // The latched frame now holds 0x35, not 0x34 -- a real state divergence.
  assert.equal(m.mem.read8(0x8069), 0x35, "mutant latched the wrong frame");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => assertPath(m, good.exp), /mem\[0x8069\]/);
});
