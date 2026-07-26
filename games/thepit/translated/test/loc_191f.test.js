// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_191f (ROM 0x191f-0x19cf, The Pit): the tile-code
// classifier / dig-arm of the actor-movement dispatch, entered from loc_18cf. B
// is the tile code under the actor and E the position accumulator; the routine
// sorts B into ranges and either bails (jp 0x1b5b), keeps moving (loc_19d0), or —
// for the diggable range [0x71,0x9a) — indexes two tables (0x1e48 for the cell,
// 0x1fb0 for the neighbour) by ((B-0x71)<<3)|(E&7), stores the expected tiles at
// 0x80a7/0x80a8, and on a mismatch stages a reaction (0x80a4/0x80a2/0x8069) then
// falls into the loc_19b9 latch tail (0x80c1:=2, 0x80b1:=0x40, request sound 0x14).
//
// It drives SIX control-flow paths — the [0x36,0x3a) escape, an exact-code bail
// (0x80c1==0), an exact-code arm-and-sound (0x80c1!=0, call 0x4c9f), the full deep
// path through BOTH tables, the >=0x9a "keep moving" exit, and the table-match
// "same tile" exit — and asserts each path's step trace / T-state total / call
// (tail-jump) target list / final PC / SP / A (and D) / and every memory write.
// The MUTATION corrupts the first table base 0x1e48 -> 0x1e00: `ld hl,nn` is 10 T
// either way so the cycle total is UNCHANGED and the path is unchanged (the read
// still mismatches D), but the byte stored at 0x80a7 changes — caught only by the
// memory assertion.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_191f } from "../loc_191f.js";

const SENTINEL = 0xbeef; // return address a tail-jump's callee `ret` must land on
const RESET_SP = 0x83ff; // initial SP; tail-jump / call pops relative to here

// Minimal machine double: the REAL thepit address space + Io + Z80 Regs, plus the
// step/call/push16/ret seam. `call` records the target and behaves as a bare `ret`
// (pops whatever the CALL/JP left on the stack) with no cycle charge — the callee's
// cost is not ours, and its own register effects are NOT applied here. A sentinel is
// seeded at the stack top so a tail-jump (which pushes nothing) lands its callee ret
// on it. seed.rom writes bytes into the ROM image so the table lookups return known
// values.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x191f,
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
  if (seed.rom) for (const [a, v] of Object.entries(seed.rom)) m.mem.rom[Number(a)] = v;
  if (seed.regs) for (const [r, v] of Object.entries(seed.regs)) m.regs[r] = v;
  if (seed.mem) for (const [a, v] of Object.entries(seed.mem)) m.mem.write8(Number(a), v);
  return m;
}

function assertPath(m, exp) {
  if (exp.steps) assert.deepEqual(m.steps, exp.steps, "step targets");
  if (exp.stepsLen !== undefined) assert.equal(m.steps.length, exp.stepsLen, "step count");
  if (exp.stepsHead)
    assert.deepEqual(m.steps.slice(0, exp.stepsHead.length), exp.stepsHead, "step head");
  if (exp.stepsTail)
    assert.deepEqual(m.steps.slice(-exp.stepsTail.length), exp.stepsTail, "step tail");
  assert.deepEqual(m.calls, exp.calls, "call / tail-jump targets");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC (tail-jump callee ret lands on sentinel)");
  assert.equal(m.regs.sp, (RESET_SP + 2) & 0xffff, "SP = reset top + 2 after one net tail pop");
  assert.equal(m.regs.a, exp.a, "A register");
  if (exp.d !== undefined) assert.equal(m.regs.d, exp.d, "D register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

const PATHS = {
  // [0x36,0x3a) escape: B=0x37 -> jr c not taken (>=0x36), cp 0x3a carry -> jp c 0x1b5b.
  b_in_36_3a_escape: {
    seed: { regs: { b: 0x37 } },
    exp: {
      steps: [0x1920, 0x1922, 0x1924, 0x1926, 0x1b5b],
      calls: [0x1b5b],
      cycles: 4 + 7 + 7 + 7 + 10, // 35
      pc: SENTINEL,
      a: 0x37,
      mem: {},
    },
  },

  // Exact-code bail: B=0x2a -> jr c to loc_1929, cp 0x2a Z -> jp z loc_19b9; 0x80c1==0
  // so the latch is NOT armed -> jp z 0x1b5b. Proves the exact-match dispatch + the bail.
  exact_2a_bail: {
    seed: { regs: { b: 0x2a }, mem: { 0x80c1: 0x00 } },
    exp: {
      steps: [0x1920, 0x1922, 0x1929, 0x192b, 0x19b9, 0x19bc, 0x19bd, 0x1b5b],
      calls: [0x1b5b],
      cycles: 4 + 7 + 12 + 7 + 10 + 13 + 4 + 10, // 67
      pc: SENTINEL,
      a: 0x00, // ld a,(0x80c1)=0 ; and a
      mem: { 0x80c1: 0x00 }, // untouched
    },
  },

  // Exact-code arm + sound: B=0x95 -> falls through loc_1929 to cp 0x95 Z -> jp z
  // loc_19b9; 0x80c1==1 (armed) -> set 0x80c1=2, 0x80b1=0x40, call 0x4c9f (sound 0x14),
  // jp 0x1b5b. Exercises the real `call` (push 0x19cd / resume) then the tail-jump.
  exact_95_arm_sound: {
    seed: { regs: { b: 0x95 }, mem: { 0x80c1: 0x01 } },
    exp: {
      steps: [
        0x1920, 0x1922, 0x1924, 0x1926, 0x1929, 0x192b, 0x192e, 0x1930, 0x1933, 0x1935,
        0x1938, 0x193a, 0x193d, 0x193f, 0x19b9, 0x19bc, 0x19bd, 0x19c0, 0x19c2, 0x19c5,
        0x19c7, 0x19ca, 0x4c9f, 0x1b5b,
      ],
      calls: [0x4c9f, 0x1b5b],
      cycles: 35 + 85 + (13 + 4 + 10 + 7 + 13 + 7 + 13 + 17 + 10), // 35 + 85 + 94 = 214
      pc: SENTINEL,
      a: 0x40, // ld a,0x40 ; callee register effects not applied by the harness
      mem: { 0x80c1: 0x02, 0x80b1: 0x40 },
    },
  },

  // >=0x9a keep-moving: B=0x9b -> falls through loc_1929, cp 0x9a NC -> jp nc loc_19d0.
  b_ge_9a_move: {
    seed: { regs: { b: 0x9b } },
    exp: {
      steps: [
        0x1920, 0x1922, 0x1924, 0x1926, 0x1929, 0x192b, 0x192e, 0x1930, 0x1933, 0x1935,
        0x1938, 0x193a, 0x193d, 0x193f, 0x1942, 0x1944, 0x1946, 0x1948, 0x194a, 0x194c,
        0x19d0,
      ],
      calls: [0x19d0],
      cycles: 35 + 130, // block A + full loc_1929 fall-through to the jp nc
      pc: SENTINEL,
      a: 0x9b,
      mem: {},
    },
  },

  // Table match -> same tile -> keep moving: B=0x96, E=0x03 (bit2 clear -> loc_194f
  // falls to loc_1954), first table byte at 0x1f73 seeded == D (0x96) -> cp d Z ->
  // jr z loc_19d0. Exercises loc_194f, loc_1954's guards, the index math, table 0x1e48.
  table_match_move: {
    seed: { regs: { b: 0x96, e: 0x03 }, rom: { 0x1f73: 0x96 } },
    exp: {
      steps: [
        0x1920, 0x1922, 0x1924, 0x1926, 0x1929, 0x192b, 0x192e, 0x1930, 0x1933, 0x1935,
        0x1938, 0x193a, 0x193d, 0x193f, 0x1942, 0x1944, 0x1946, 0x1948, 0x194a, 0x194c,
        0x194f, 0x1951, 0x1954, 0x1956, 0x1959, 0x195b, 0x195e, 0x195f, 0x1961, 0x1963,
        0x1965, 0x1967, 0x1969, 0x196b, 0x196c, 0x196d, 0x196f, 0x1970, 0x1971, 0x1974,
        0x1975, 0x1976, 0x1979, 0x197a, 0x19d0,
      ],
      calls: [0x19d0],
      cycles: 35 + 130 + 18 + 164, // 347
      pc: SENTINEL,
      a: 0x96, // table byte == D
      d: 0x96,
      mem: { 0x80a7: 0x96 },
    },
  },

  // Deep path through BOTH tables -> mismatch -> stage reaction -> loc_19b9 bail.
  // B=0x96,E=0x03 (bit2 clear). First table 0x1f73=0x88 (!= D=0x96) so the reaction is
  // staged; (E&7)=3 != 0 so the neighbour cell (ix+1)=mem[0x8101]=0x80 is looked up in
  // table 0x1fb0 at 0x202b=0x99. 0x80c1==0 so loc_19b9 bails to 0x1b5b.
  deep_both_tables: {
    seed: {
      regs: { b: 0x96, e: 0x03, ix: 0x8100 },
      mem: { 0x8101: 0x80, 0x80a3: 0x77, 0x80c1: 0x00 },
      rom: { 0x1f73: 0x88, 0x202b: 0x99 },
    },
    exp: {
      stepsLen: 78,
      stepsHead: [0x1920, 0x1922, 0x1924, 0x1926, 0x1929],
      stepsTail: [0x19b4, 0x19b5, 0x19b6, 0x19b9, 0x19bc, 0x19bd, 0x1b5b],
      calls: [0x1b5b],
      cycles: 35 + 130 + 18 + 413 + 27, // 623
      pc: SENTINEL,
      a: 0x00, // ld a,(0x80c1)=0 ; and a
      d: 0x96,
      mem: {
        0x80a7: 0x88, // first table result
        0x80a4: 0x77, // copied from 0x80a3
        0x80a2: 0x03,
        0x8069: 0x36,
        0x80a6: 0x80, // neighbour tile code (ix+1)
        0x80a8: 0x99, // second table result
        0x80c1: 0x00, // bail path: NOT armed
      },
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_191f(m);
    assertPath(m, exp);
  });
}

// -- MUTATION: the first table base 0x1e48 -> 0x1e00. `ld hl,nn` is 10 T either way,
// so the cycle total is IDENTICAL; the table read lands at a different ROM byte, so
// the value stored at 0x80a7 changes (and, because the read still mismatches D, the
// control flow and every other write are unchanged — a pure value divergence a
// cycle-only check would miss). Byte-for-byte copy of loc_191f with only that base
// changed.
function loc_191f_mutant(m) {
  const { regs, mem } = m;
  blk19b9: {
    blk1954: {
      blk194f: {
        blk1929: {
          regs.a = regs.b;
          m.step(0x1920, 4);
          regs.cp(0x36);
          m.step(0x1922, 7);
          if (regs.fC) {
            m.step(0x1929, 12);
            break blk1929;
          }
          m.step(0x1924, 7);
          regs.cp(0x3a);
          m.step(0x1926, 7);
          if (regs.fC) {
            m.step(0x1b5b, 10);
            return m.call(0x1b5b);
          }
          m.step(0x1929, 10);
        }
        regs.cp(0x2a);
        m.step(0x192b, 7);
        if (regs.fZ) {
          m.step(0x19b9, 10);
          break blk19b9;
        }
        m.step(0x192e, 10);
        regs.cp(0x2b);
        m.step(0x1930, 7);
        if (regs.fZ) {
          m.step(0x19b9, 10);
          break blk19b9;
        }
        m.step(0x1933, 10);
        regs.cp(0x41);
        m.step(0x1935, 7);
        if (regs.fZ) {
          m.step(0x19b9, 10);
          break blk19b9;
        }
        m.step(0x1938, 10);
        regs.cp(0xc1);
        m.step(0x193a, 7);
        if (regs.fZ) {
          m.step(0x19b9, 10);
          break blk19b9;
        }
        m.step(0x193d, 10);
        regs.cp(0x95);
        m.step(0x193f, 7);
        if (regs.fZ) {
          m.step(0x19b9, 10);
          break blk19b9;
        }
        m.step(0x1942, 10);
        regs.cp(0xc4);
        m.step(0x1944, 7);
        if (regs.fZ) {
          m.step(0x194f, 12);
          break blk194f;
        }
        m.step(0x1946, 7);
        regs.cp(0x96);
        m.step(0x1948, 7);
        if (regs.fC) {
          m.step(0x1954, 12);
          break blk1954;
        }
        m.step(0x194a, 7);
        regs.cp(0x9a);
        m.step(0x194c, 7);
        if (regs.fNC) {
          m.step(0x19d0, 10);
          return m.call(0x19d0);
        }
        m.step(0x194f, 10);
      }
      regs.bit(2, regs.e);
      m.step(0x1951, 8);
      if (regs.fNZ) {
        m.step(0x19b9, 10);
        break blk19b9;
      }
      m.step(0x1954, 10);
    }
    regs.cp(0x71);
    m.step(0x1956, 7);
    if (regs.fC) {
      m.step(0x19d0, 10);
      return m.call(0x19d0);
    }
    m.step(0x1959, 10);
    regs.cp(0x9a);
    m.step(0x195b, 7);
    if (regs.fNC) {
      m.step(0x19d0, 10);
      return m.call(0x19d0);
    }
    m.step(0x195e, 10);
    regs.d = regs.a;
    m.step(0x195f, 4);
    regs.sub(0x71);
    m.step(0x1961, 7);
    regs.b = 0x00;
    m.step(0x1963, 7);
    regs.a = regs.sla(regs.a);
    m.step(0x1965, 8);
    regs.a = regs.sla(regs.a);
    m.step(0x1967, 8);
    regs.a = regs.sla(regs.a);
    m.step(0x1969, 8);
    regs.b = regs.rl(regs.b);
    m.step(0x196b, 8);
    regs.c = regs.a;
    m.step(0x196c, 4);
    regs.a = regs.e;
    m.step(0x196d, 4);
    regs.and(0x07);
    m.step(0x196f, 7);
    regs.or(regs.c);
    m.step(0x1970, 4);
    regs.c = regs.a;
    m.step(0x1971, 4);
    regs.hl = 0x1e00; // BUG: first table base should be 0x1e48
    m.step(0x1974, 10);
    regs.addHl(regs.bc);
    m.step(0x1975, 11);
    regs.a = mem.read8(regs.hl);
    m.step(0x1976, 7);
    mem.write8(0x80a7, regs.a);
    m.step(0x1979, 13);
    regs.cp(regs.d);
    m.step(0x197a, 4);
    if (regs.fZ) {
      m.step(0x19d0, 12);
      return m.call(0x19d0);
    }
    m.step(0x197c, 7);
    regs.a = mem.read8(0x80a3);
    m.step(0x197f, 13);
    mem.write8(0x80a4, regs.a);
    m.step(0x1982, 13);
    regs.a = 0x03;
    m.step(0x1984, 7);
    mem.write8(0x80a2, regs.a);
    m.step(0x1987, 13);
    regs.a = 0x36;
    m.step(0x1989, 7);
    mem.write8(0x8069, regs.a);
    m.step(0x198c, 13);
    regs.a = regs.e;
    m.step(0x198d, 4);
    regs.and(0x07);
    m.step(0x198f, 7);
    if (regs.fZ) {
      m.step(0x19b9, 12);
      break blk19b9;
    }
    m.step(0x1991, 7);
    regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
    m.step(0x1994, 19);
    mem.write8(0x80a6, regs.a);
    m.step(0x1997, 13);
    regs.cp(0x71);
    m.step(0x1999, 7);
    if (regs.fC) {
      m.step(0x19b9, 12);
      break blk19b9;
    }
    m.step(0x199b, 7);
    regs.cp(0x9a);
    m.step(0x199d, 7);
    if (regs.fNC) {
      m.step(0x19b9, 12);
      break blk19b9;
    }
    m.step(0x199f, 7);
    regs.sub(0x71);
    m.step(0x19a1, 7);
    regs.b = 0x00;
    m.step(0x19a3, 7);
    regs.a = regs.sla(regs.a);
    m.step(0x19a5, 8);
    regs.a = regs.sla(regs.a);
    m.step(0x19a7, 8);
    regs.a = regs.sla(regs.a);
    m.step(0x19a9, 8);
    regs.b = regs.rl(regs.b);
    m.step(0x19ab, 8);
    regs.c = regs.a;
    m.step(0x19ac, 4);
    regs.a = regs.e;
    m.step(0x19ad, 4);
    regs.and(0x07);
    m.step(0x19af, 7);
    regs.or(regs.c);
    m.step(0x19b0, 4);
    regs.c = regs.a;
    m.step(0x19b1, 4);
    regs.hl = 0x1fb0;
    m.step(0x19b4, 10);
    regs.addHl(regs.bc);
    m.step(0x19b5, 11);
    regs.a = mem.read8(regs.hl);
    m.step(0x19b6, 7);
    mem.write8(0x80a8, regs.a);
    m.step(0x19b9, 13);
  }
  regs.a = mem.read8(0x80c1);
  m.step(0x19bc, 13);
  regs.and(regs.a);
  m.step(0x19bd, 4);
  if (regs.fZ) {
    m.step(0x1b5b, 10);
    return m.call(0x1b5b);
  }
  m.step(0x19c0, 10);
  regs.a = 0x02;
  m.step(0x19c2, 7);
  mem.write8(0x80c1, regs.a);
  m.step(0x19c5, 13);
  regs.a = 0x40;
  m.step(0x19c7, 7);
  mem.write8(0x80b1, regs.a);
  m.step(0x19ca, 13);
  m.push16(0x19cd);
  m.step(0x4c9f, 17);
  m.call(0x4c9f);
  m.step(0x1b5b, 10);
  return m.call(0x1b5b);
}

test("mutation: first table base 0x1e48 -> 0x1e00 stores the wrong tile (caught by memory)", () => {
  const good = PATHS.deep_both_tables;
  const m = makeMachine(good.seed);
  loc_191f_mutant(m);
  // Cycles are identical to the honest routine (ld hl,nn is 10 T regardless).
  assert.equal(m.cycles, good.exp.cycles, "mutation preserves the cycle total");
  // The corrupted base reads ROM[0x1f2b] (unseeded = 0) instead of ROM[0x1f73]=0x88.
  assert.equal(m.mem.read8(0x80a7), 0x00, "mutant stored the wrong table byte");
  // The spec the honest routine passes MUST reject the mutant.
  assert.throws(() => assertPath(m, good.exp), /mem\[0x80a7\]/);
});
