// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_18cf (ROM 0x18cf-0x191e, The Pit): the tile-boundary
// "prize / special tile" arm of the actor-movement dispatch. It fires only on an
// 8-unit boundary ((E+1)&7 == 0); otherwise, and for any tile code it does not
// recognise, it tail-jumps to loc_191f. On a boundary it awards score for tile
// 0x3a (+10, counter 0x8081) or 0x3b/0x3c/0x3d (+20, counter 0x8082, gated on the
// feature flag 0x8076 and a one-shot 0x8078/0x80bd latch), blanks the actor's
// video cell (ix = mem[0x806e]; (ix+0) = 0x70), and continues at loc_19d0.
//
// The test drives SIX control-flow paths (the A/C tail exits, the +10 award, the
// full +20 latch-and-award, the guard bail, and the already-latched direct award)
// and asserts each path's exact T-state total, instruction-boundary step trace,
// call/tail-jump target list, final PC (the tail-jump callee's ret lands on a
// seeded sentinel), SP, the surviving A register, and every memory write (plus a
// couple of must-NOT-write checks on the counters). It then re-runs a copy whose
// blank-tile constant is corrupted 0x70 -> 0x60: a `ld a,n` is 7 T either way, so
// the cycle total is UNCHANGED and only the memory assertion on the blanked cell
// catches it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_18cf } from "../loc_18cf.js";

const SENTINEL = 0xbeef; // return address the tail-jump's callee `ret` must land on
const RESET_SP = 0x83ff; // initial SP; the tail-jump / call pops relative to here

// Minimal machine double: the REAL thepit address space + Io + Z80 Regs, plus the
// step/call/push16/ret seam. `call` records the target and behaves as a bare `ret`
// (pops whatever the CALL/JP left on the stack) with no cycle charge — the callee's
// cost is not ours. A sentinel is seeded at the stack top so a tail-jump (which
// pushes nothing) lands its callee ret on it.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x18cf,
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
  assert.deepEqual(m.calls, exp.calls, "call / tail-jump targets");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC (tail-jump callee ret lands on sentinel)");
  assert.equal(m.regs.sp, (RESET_SP + 2) & 0xffff, "SP = reset top + 2 after one tail pop");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

const PATHS = {
  // A-tail: E=0x00 -> (0+1)&7 = 1 != 0 -> not a boundary -> jr nz to loc_191f.
  // Seeds a counter and proves it is untouched on this read-only path.
  a_tail_not_boundary: {
    seed: { regs: { e: 0x00 }, mem: { 0x8081: 0x05 } },
    exp: {
      steps: [0x18d0, 0x18d1, 0x18d3, 0x191f],
      calls: [0x191f],
      cycles: 4 + 4 + 7 + 12,
      pc: SENTINEL,
      a: 0x01, // (E+1)&7
      mem: { 0x8081: 0x05 }, // unchanged
    },
  },

  // +10 award: boundary (E=0x07 -> 8 & 7 = 0), tile 0x3a. Bumps 0x8081, blanks the
  // cell at ix=mem[0x806e]=0x9010, jp 0x19d0.
  tile_3a_plus10: {
    seed: { regs: { e: 0x07, b: 0x3a }, mem: { 0x8081: 0x05, 0x806e: 0x10, 0x806f: 0x90 } },
    exp: {
      steps: [
        0x18d0, 0x18d1, 0x18d3, 0x18d5, 0x18d6, 0x18d8, 0x18da, 0x467b, 0x18e0, 0x18e1,
        0x18e4, 0x1913, 0x1917, 0x1919, 0x191c, 0x19d0,
      ],
      calls: [0x467b, 0x19d0],
      cycles: 4 + 4 + 7 + 7 + 4 + 7 + 7 + 17 + 13 + 4 + 13 + 12 + 20 + 7 + 19 + 10, // 155
      pc: SENTINEL,
      a: 0x70,
      mem: { 0x8081: 0x06, 0x9010: 0x70 },
    },
  },

  // +20 full latch: boundary, tile 0x3b, feature 0x8076 enabled, latch 0x8078==0,
  // guard 0x80bd==0 -> set latch to 1, call +20, bump 0x8082, blank the cell.
  tile_3b_plus20_latch: {
    seed: {
      regs: { e: 0x07, b: 0x3b },
      mem: { 0x8076: 0x01, 0x8078: 0x00, 0x80bd: 0x00, 0x8082: 0x0a, 0x806e: 0x20, 0x806f: 0x90 },
    },
    exp: {
      steps: [
        0x18d0, 0x18d1, 0x18d3, 0x18d5, 0x18d6, 0x18d8, 0x18e6, 0x18e9, 0x18ea, 0x18ec,
        0x18ed, 0x18ef, 0x18f9, 0x18fc, 0x18fd, 0x18ff, 0x1902, 0x1903, 0x1905, 0x1906,
        0x1909, 0x4683, 0x190f, 0x1910, 0x1913, 0x1917, 0x1919, 0x191c, 0x19d0,
      ],
      calls: [0x4683, 0x19d0],
      cycles: 260,
      pc: SENTINEL,
      a: 0x70,
      mem: { 0x8078: 0x01, 0x8082: 0x0b, 0x9020: 0x70 },
    },
  },

  // C-tail: boundary, feature enabled, tile 0x40 matches none of 0x3b/0x3c/0x3d ->
  // jr nz to loc_191f. Proves the full compare chain and that no counter moves.
  tile_unrecognised_c_tail: {
    seed: { regs: { e: 0x07, b: 0x40 }, mem: { 0x8076: 0x01, 0x8081: 0x05, 0x8082: 0x0a } },
    exp: {
      steps: [
        0x18d0, 0x18d1, 0x18d3, 0x18d5, 0x18d6, 0x18d8, 0x18e6, 0x18e9, 0x18ea, 0x18ec,
        0x18ed, 0x18ef, 0x18f1, 0x18f3, 0x18f5, 0x18f7, 0x191f,
      ],
      calls: [0x191f],
      cycles: 120,
      pc: SENTINEL,
      a: 0x40,
      mem: { 0x8081: 0x05, 0x8082: 0x0a }, // both untouched
    },
  },

  // Guard bail: boundary, tile 0x3c, feature enabled, latch 0x8078==0 but guard
  // 0x80bd != 0 -> jr nz to loc_191f WITHOUT setting the latch or awarding.
  tile_3c_guard_bail: {
    seed: {
      regs: { e: 0x07, b: 0x3c },
      mem: { 0x8076: 0x01, 0x8078: 0x00, 0x80bd: 0x01, 0x8082: 0x0a },
    },
    exp: {
      steps: [
        0x18d0, 0x18d1, 0x18d3, 0x18d5, 0x18d6, 0x18d8, 0x18e6, 0x18e9, 0x18ea, 0x18ec,
        0x18ed, 0x18ef, 0x18f1, 0x18f3, 0x18f9, 0x18fc, 0x18fd, 0x18ff, 0x1902, 0x1903,
        0x191f,
      ],
      calls: [0x191f],
      cycles: 159,
      pc: SENTINEL,
      a: 0x01, // mem[0x80bd]
      mem: { 0x8078: 0x00, 0x8082: 0x0a }, // latch NOT set, counter untouched
    },
  },

  // Already latched: boundary, tile 0x3d, feature enabled, latch 0x8078 already 1
  // -> skip the guard and award directly (jr nz to the shared +20 block).
  tile_3d_already_latched: {
    seed: {
      regs: { e: 0x07, b: 0x3d },
      mem: { 0x8076: 0x01, 0x8078: 0x01, 0x8082: 0x00, 0x806e: 0x30, 0x806f: 0x90 },
    },
    exp: {
      steps: [
        0x18d0, 0x18d1, 0x18d3, 0x18d5, 0x18d6, 0x18d8, 0x18e6, 0x18e9, 0x18ea, 0x18ec,
        0x18ed, 0x18ef, 0x18f1, 0x18f3, 0x18f5, 0x18f7, 0x18f9, 0x18fc, 0x18fd, 0x1909,
        0x4683, 0x190f, 0x1910, 0x1913, 0x1917, 0x1919, 0x191c, 0x19d0,
      ],
      calls: [0x4683, 0x19d0],
      cycles: 247,
      pc: SENTINEL,
      a: 0x70,
      mem: { 0x8078: 0x01, 0x8082: 0x01, 0x9030: 0x70 },
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_18cf(m);
    assertPath(m, exp);
  });
}

// -- MUTATION: the blank-tile constant 0x70 -> 0x60. A `ld a,n` is 7 T either way,
// so the cycle total is IDENTICAL; the state assertions (the surviving A register
// AND the blanked cell, both of which become 0x60) reject it — exactly the kind of
// value error a cycle-only check would miss. Full byte-for-byte copy of loc_18cf
// with only that one constant changed.
function loc_18cf_mutant(m) {
  const { regs, mem } = m;
  blkG: {
    blkE: {
      blkD: {
        blkC: {
          regs.a = regs.e;
          m.step(0x18d0, 4);
          regs.a = regs.inc8(regs.a);
          m.step(0x18d1, 4);
          regs.and(0x07);
          m.step(0x18d3, 7);
          if (regs.fNZ) {
            m.step(0x191f, 12);
            return m.call(0x191f);
          }
          m.step(0x18d5, 7);
          regs.a = regs.b;
          m.step(0x18d6, 4);
          regs.cp(0x3a);
          m.step(0x18d8, 7);
          if (regs.fNZ) {
            m.step(0x18e6, 12);
            break blkC;
          }
          m.step(0x18da, 7);
          m.push16(0x18dd);
          m.step(0x467b, 17);
          m.call(0x467b);
          regs.a = mem.read8(0x8081);
          m.step(0x18e0, 13);
          regs.a = regs.inc8(regs.a);
          m.step(0x18e1, 4);
          mem.write8(0x8081, regs.a);
          m.step(0x18e4, 13);
          m.step(0x1913, 12);
          break blkG;
        }
        regs.a = mem.read8(0x8076);
        m.step(0x18e9, 13);
        regs.and(regs.a);
        m.step(0x18ea, 4);
        if (regs.fZ) {
          m.step(0x191f, 12);
          return m.call(0x191f);
        }
        m.step(0x18ec, 7);
        regs.a = regs.b;
        m.step(0x18ed, 4);
        regs.cp(0x3b);
        m.step(0x18ef, 7);
        if (regs.fZ) {
          m.step(0x18f9, 12);
          break blkD;
        }
        m.step(0x18f1, 7);
        regs.cp(0x3c);
        m.step(0x18f3, 7);
        if (regs.fZ) {
          m.step(0x18f9, 12);
          break blkD;
        }
        m.step(0x18f5, 7);
        regs.cp(0x3d);
        m.step(0x18f7, 7);
        if (regs.fNZ) {
          m.step(0x191f, 12);
          return m.call(0x191f);
        }
        m.step(0x18f9, 7);
      }
      regs.a = mem.read8(0x8078);
      m.step(0x18fc, 13);
      regs.or(regs.a);
      m.step(0x18fd, 4);
      if (regs.fNZ) {
        m.step(0x1909, 12);
        break blkE;
      }
      m.step(0x18ff, 7);
      regs.a = mem.read8(0x80bd);
      m.step(0x1902, 13);
      regs.or(regs.a);
      m.step(0x1903, 4);
      if (regs.fNZ) {
        m.step(0x191f, 12);
        return m.call(0x191f);
      }
      m.step(0x1905, 7);
      regs.a = regs.inc8(regs.a);
      m.step(0x1906, 4);
      mem.write8(0x8078, regs.a);
      m.step(0x1909, 13);
    }
    m.push16(0x190c);
    m.step(0x4683, 17);
    m.call(0x4683);
    regs.a = mem.read8(0x8082);
    m.step(0x190f, 13);
    regs.a = regs.inc8(regs.a);
    m.step(0x1910, 4);
    mem.write8(0x8082, regs.a);
    m.step(0x1913, 13);
  }
  regs.ix = mem.read16(0x806e);
  m.step(0x1917, 20);
  regs.a = 0x60; // BUG: blank tile should be 0x70
  m.step(0x1919, 7);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x191c, 19);
  m.step(0x19d0, 10);
  return m.call(0x19d0);
}

test("mutation: corrupted blank-tile constant (0x70 -> 0x60) is caught by memory", () => {
  const good = PATHS.tile_3a_plus10;
  const m = makeMachine(good.seed);
  loc_18cf_mutant(m);
  // Cycles are identical to the honest routine (ld a,n is 7 T regardless).
  assert.equal(m.cycles, good.exp.cycles, "mutation preserves the cycle total");
  // The blanked cell now holds 0x60, not 0x70 -- a real state divergence.
  assert.equal(m.mem.read8(0x9010), 0x60, "mutant wrote the wrong blank tile");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => assertPath(m, good.exp), /A register|mem\[0x9010\]/);
});
