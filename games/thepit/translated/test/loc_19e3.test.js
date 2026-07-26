// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_19e3 (ROM 0x19e3-0x1a01, The Pit): store the actor's
// sprite/state code into record byte 0x8069, then apply the far-edge boundary
// latch. If the actor is active (0x8077 != 0) AND its position 0x806b has reached
// >= 0x8a, it latches 0x807c = 0xb4 and clears 0x8068 = 0; otherwise it touches
// neither. Every exit tail-jumps to loc_1b5b, whose ret unwinds to OUR caller.
//
// The test drives THREE control-flow paths (inactive jp-z tail; active-but-short
// jp-c tail; active-and-at-edge full latch) and asserts each path's exact T-state
// total, instruction-boundary step trace, tail-jump target list, final PC (the
// callee ret lands on a seeded sentinel), SP (one tail pop), the surviving A, and
// every memory write (plus must-NOT-write checks on 0x807c / 0x8068 for the two
// tail paths). It then re-runs a copy whose latch constant is corrupted
// 0xb4 -> 0xa4: a `ld a,n` is 7 T either way, so the cycle total is UNCHANGED and
// only the memory assertion on 0x807c catches it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_19e3 } from "../loc_19e3.js";

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
    pc: 0x19e3,
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
      this.pc = this.pop16(); // bare-ret behaviour; balances the tail-jump
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
  // Inactive: 0x8077 == 0 -> `and a` sets Z -> jp z 0x1b5b. Only 0x8069 is written
  // (the entry A). 0x807c / 0x8068 must stay as seeded.
  inactive_z_tail: {
    seed: { regs: { a: 0x34 }, mem: { 0x8077: 0x00, 0x807c: 0x11, 0x8068: 0x22 } },
    exp: {
      steps: [0x19e6, 0x19e9, 0x19ea, 0x1b5b],
      calls: [0x1b5b],
      cycles: 13 + 13 + 4 + 10, // 40
      pc: SENTINEL,
      a: 0x00, // A := mem[0x8077] == 0
      mem: { 0x8069: 0x34, 0x807c: 0x11, 0x8068: 0x22 },
    },
  },

  // Active but short of the edge: 0x8077 != 0, 0x806b = 0x50 (< 0x8a) -> cp sets
  // carry -> jp c 0x1b5b. Still no latch: 0x807c / 0x8068 untouched.
  active_short_c_tail: {
    seed: { regs: { a: 0x34 }, mem: { 0x8077: 0x01, 0x806b: 0x50, 0x807c: 0x11, 0x8068: 0x22 } },
    exp: {
      steps: [0x19e6, 0x19e9, 0x19ea, 0x19ed, 0x19f0, 0x19f2, 0x1b5b],
      calls: [0x1b5b],
      cycles: 13 + 13 + 4 + 10 + 13 + 7 + 10, // 70
      pc: SENTINEL,
      a: 0x50, // A := mem[0x806b]
      mem: { 0x8069: 0x34, 0x807c: 0x11, 0x8068: 0x22 },
    },
  },

  // Active and exactly at the edge: 0x806b = 0x8a -> cp 0x8a clears carry (0x8a is
  // NOT < 0x8a) -> the latch fires: 0x807c := 0xb4, 0x8068 := 0, jp 0x1b5b.
  active_at_edge_latch: {
    seed: { regs: { a: 0x34 }, mem: { 0x8077: 0x01, 0x806b: 0x8a, 0x807c: 0x11, 0x8068: 0x22 } },
    exp: {
      steps: [
        0x19e6, 0x19e9, 0x19ea, 0x19ed, 0x19f0, 0x19f2, 0x19f5, 0x19f7, 0x19fa, 0x19fc, 0x19ff,
        0x1b5b,
      ],
      calls: [0x1b5b],
      cycles: 13 + 13 + 4 + 10 + 13 + 7 + 10 + 7 + 13 + 7 + 13 + 10, // 120
      pc: SENTINEL,
      a: 0x00, // last `ld a,0x00`
      mem: { 0x8069: 0x34, 0x807c: 0xb4, 0x8068: 0x00 },
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_19e3(m);
    assertPath(m, exp);
  });
}

// -- MUTATION: the boundary-latch constant 0xb4 -> 0xa4 at 0x19f5. A `ld a,n` is
// 7 T either way, so the cycle total is IDENTICAL; only the memory assertion on
// 0x807c (which becomes 0xa4, not 0xb4) catches it — exactly the kind of value
// error a cycle-only check would miss. Byte-for-byte copy of loc_19e3 with only
// that one constant changed.
function loc_19e3_mutant(m) {
  const { regs, mem } = m;
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
  regs.a = 0xa4; // BUG: latch constant should be 0xb4
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

test("mutation: corrupted latch constant (0xb4 -> 0xa4) is caught by memory", () => {
  const good = PATHS.active_at_edge_latch;
  const m = makeMachine(good.seed);
  loc_19e3_mutant(m);
  // Cycles are identical to the honest routine (ld a,n is 7 T regardless).
  assert.equal(m.cycles, good.exp.cycles, "mutation preserves the cycle total");
  // 0x807c now holds 0xa4, not 0xb4 -- a real state divergence.
  assert.equal(m.mem.read8(0x807c), 0xa4, "mutant latched the wrong constant");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => assertPath(m, good.exp), /mem\[0x807c\]/);
});
