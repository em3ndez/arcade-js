// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_186f (ROM 0x186f-0x18ce): builds the actor's video-RAM
// cell pointer from the position counters at 0x8068 / 0x806b (+ caller's D),
// stashes the row/column grid coords at 0x8073 / 0x8071, stores the pointer at
// 0x806e, reads the tile under the actor, publishes it at 0x80a5 / 0x80a7 (and
// clears 0x80a8), then dispatches on it. The routine NEVER rets -- it always
// tail-jumps. The three drivers exercise every exit:
//   A) tile != 0x27            -> jr nz,0x18cf taken   -> call 0x18cf
//   B) tile == 0x27, col<0x53  -> jr c,0x18cf  taken   -> call 0x18cf
//   C) tile == 0x27, col>=0x53 -> both jr's fall through -> jp 0x19d0 -> call 0x19d0
// Each pins the exact T-state total, the instruction-boundary step sequence, the
// tail-jump target, the derived memory writes, and the surviving A/B registers.
// Path A also carries a non-zero D so `add a,d` (0x1885) is exercised, not just
// its D==0 no-op. The mutation corrupts the row-bias constant `add a,0x1f` ->
// `add a,0x1e`; that is 7T either way, so the cycle total is UNCHANGED and it is
// the memory assertions (0x8073 and the shifted-through pointer) that reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_186f } from "../loc_186f.js";

// Minimal leaf-routine machine double: exactly the surface loc_186f touches
// (regs, mem, step, call). step advances PC + charges cycles; call records the
// tail-jump target WITHOUT invoking a real routine (loc_18cf / loc_19d0 are
// separate units), modelling "control transferred there and never came back".
function makeMachine(seed = {}, d = 0x00) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x186f,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller; nothing to do here
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  m.regs.d = d;
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.equal(m.returned, exp.returned, "early ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  assert.equal(m.regs.b, exp.b, "B register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// Steps 0x1872 .. 0x18bd (through `cp 0x27`), common to all three paths.
const STEPS_COMMON = [
  0x1872, 0x1874, 0x1876, 0x1878, 0x187a, 0x187c, 0x187e, 0x1881, 0x1882,
  0x1885, 0x1886, 0x1888, 0x1889, 0x188b, 0x188d, 0x188f, 0x1892, 0x1893, 0x1895,
  0x1896, 0x1898, 0x1899, 0x189b, 0x189c, 0x189e, 0x189f, 0x18a0, 0x18a1, 0x18a4,
  0x18a5, 0x18a8, 0x18ac, 0x18ae, 0x18b1, 0x18b4, 0x18b7, 0x18ba, 0x18bb, 0x18bd,
];
// Sum of those instructions' T-states == 340 (asserted below so the number is checked).
const CYC_COMMON =
  13 + 7 + 8 + 8 + 8 + 8 + 7 + 13 + 4 + // 186f..1881
  13 + 4 + 7 + 4 + 8 + 8 + 8 + 13 + 4 + 7 + 4 + // 1882..1895
  8 + 4 + 8 + 4 + 8 + 4 + 4 + 11 + 10 + 11 + 16 + 20 + // 1896..18ac
  7 + 13 + 19 + 13 + 13 + 4 + 7; // 18ac..18bd (cp 0x27)

test("CYC_COMMON is 340", () => assert.equal(CYC_COMMON, 340));

const PATHS = {
  // A) mem[0x8068]=0 -> row 0x1f ; mem[0x806b]=0x40 + D=0x10 + 0x0c = 0x5c -> col cell
  //    0x0b ; pointer HL = 0x03E0 + 0x000b + 0x9000 = 0x93EB ; tile there = 0x10
  //    (!= 0x27) -> jr nz,0x18cf taken.
  tile_ne_27_jrnz: {
    seed: { 0x8068: 0x00, 0x806b: 0x40, 0x93eb: 0x10 },
    d: 0x10,
    exp: {
      steps: [...STEPS_COMMON, 0x18cf],
      calls: [0x18cf],
      returned: false,
      cycles: CYC_COMMON + 12, // jr nz taken
      pc: 0x18cf,
      a: 0x10,
      b: 0x10,
      mem: {
        0x8073: 0x1f, 0x8071: 0x0b, 0x806e: 0xeb, 0x806f: 0x93,
        0x80a8: 0x00, 0x80a5: 0x10, 0x80a7: 0x10,
      },
    },
  },

  // B) mem[0x8068]=0 -> row 0x1f ; mem[0x806b]=0x40, D=0 -> col cell 0x09 ; pointer
  //    HL = 0x03E0 + 0x0009 + 0x9000 = 0x93E9 ; tile there = 0x27 -> jr nz NOT taken;
  //    then 0x806b (0x40) cp 0x53 -> carry set -> jr c,0x18cf taken.
  tile_27_col_lt_53_jrc: {
    seed: { 0x8068: 0x00, 0x806b: 0x40, 0x93e9: 0x27 },
    d: 0x00,
    exp: {
      steps: [...STEPS_COMMON, 0x18bf, 0x18c2, 0x18c5, 0x18c7, 0x18cf],
      calls: [0x18cf],
      returned: false,
      cycles: CYC_COMMON + 7 + 13 + 13 + 7 + 12, // jr nz nt 7, latch 13, ld a 13, cp 7, jr c taken 12
      pc: 0x18cf,
      a: 0x40,
      b: 0x27,
      mem: {
        0x8073: 0x1f, 0x8071: 0x09, 0x806e: 0xe9, 0x806f: 0x93,
        0x80a8: 0x00, 0x80a5: 0x27, 0x80a7: 0x27, 0x80e7: 0x27,
      },
    },
  },

  // C) mem[0x8068]=0 -> row 0x1f ; mem[0x806b]=0x53, D=0 -> biased 0x5f -> col cell
  //    0x0b ; pointer HL = 0x93EB ; tile there = 0x27 -> jr nz NOT taken; then
  //    0x806b (0x53) cp 0x53 -> Z, carry clear -> jr c NOT taken -> store, jp 0x19d0.
  tile_27_col_ge_53_jp: {
    seed: { 0x8068: 0x00, 0x806b: 0x53, 0x93eb: 0x27 },
    d: 0x00,
    exp: {
      steps: [...STEPS_COMMON, 0x18bf, 0x18c2, 0x18c5, 0x18c7, 0x18c9, 0x18cc, 0x19d0],
      calls: [0x19d0],
      returned: false,
      cycles: CYC_COMMON + 7 + 13 + 13 + 7 + 7 + 13 + 10, // jr nz nt, latch, ld a, cp, jr c nt, store, jp
      pc: 0x19d0,
      a: 0x53,
      b: 0x27,
      mem: {
        0x8073: 0x1f, 0x8071: 0x0b, 0x806e: 0xeb, 0x806f: 0x93,
        0x80a8: 0x00, 0x80a5: 0x27, 0x80a7: 0x27, 0x80e7: 0x27, 0x8077: 0x53,
      },
    },
  },
};

for (const [name, { seed, d, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed, d);
    loc_186f(m);
    assertPath(m, exp);
  });
}

test("mutation: a corrupted row-bias constant is caught", () => {
  // Byte-identical to loc_186f except `add a,0x1f` (0x187c) becomes `add a,0x1e`.
  // A `add a,n` is 7T either way, so the cycle total is UNCHANGED; the row store
  // at 0x8073 (0x1f -> 0x1e) and the shifted-through pointer / published tile are
  // what must reject it. Only the head of the routine differs; it is transcribed
  // through the cp 0x27 and then reuses the honest tail via a small closure would
  // over-complicate, so the whole path-A body is inlined with the one bad byte.
  function loc_186f_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x8068); m.step(0x1872, 13);
    regs.add(0x03); m.step(0x1874, 7);
    regs.a = regs.srl(regs.a); m.step(0x1876, 8);
    regs.a = regs.srl(regs.a); m.step(0x1878, 8);
    regs.a = regs.srl(regs.a); m.step(0x187a, 8);
    regs.neg(); m.step(0x187c, 8);
    regs.add(0x1e); m.step(0x187e, 7); // BUG: should be add a,0x1f
    mem.write8(0x8073, regs.a); m.step(0x1881, 13);
    regs.h = regs.a; m.step(0x1882, 4);
    regs.a = mem.read8(0x806b); m.step(0x1885, 13);
    regs.add(regs.d); m.step(0x1886, 4);
    regs.add(0x0c); m.step(0x1888, 7);
    regs.e = regs.a; m.step(0x1889, 4);
    regs.a = regs.srl(regs.a); m.step(0x188b, 8);
    regs.a = regs.srl(regs.a); m.step(0x188d, 8);
    regs.a = regs.srl(regs.a); m.step(0x188f, 8);
    mem.write8(0x8071, regs.a); m.step(0x1892, 13);
    regs.c = regs.a; m.step(0x1893, 4);
    regs.a = 0x00; m.step(0x1895, 7);
    regs.b = regs.a; m.step(0x1896, 4);
    regs.h = regs.srl(regs.h); m.step(0x1898, 8);
    regs.rra(); m.step(0x1899, 4);
    regs.h = regs.srl(regs.h); m.step(0x189b, 8);
    regs.rra(); m.step(0x189c, 4);
    regs.h = regs.srl(regs.h); m.step(0x189e, 8);
    regs.rra(); m.step(0x189f, 4);
    regs.l = regs.a; m.step(0x18a0, 4);
    regs.addHl(regs.bc); m.step(0x18a1, 11);
    regs.bc = 0x9000; m.step(0x18a4, 10);
    regs.addHl(regs.bc); m.step(0x18a5, 11);
    mem.write16(0x806e, regs.hl); m.step(0x18a8, 16);
    regs.ix = mem.read16(0x806e); m.step(0x18ac, 20);
    regs.a = 0x00; m.step(0x18ae, 7);
    mem.write8(0x80a8, regs.a); m.step(0x18b1, 13);
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x18b4, 19);
    mem.write8(0x80a5, regs.a); m.step(0x18b7, 13);
    mem.write8(0x80a7, regs.a); m.step(0x18ba, 13);
    regs.b = regs.a; m.step(0x18bb, 4);
    regs.cp(0x27); m.step(0x18bd, 7);
    if (regs.fNZ) { m.step(0x18cf, 12); return m.call(0x18cf); }
    m.step(0x18bf, 7);
    mem.write8(0x80e7, regs.a); m.step(0x18c2, 13);
    regs.a = mem.read8(0x806b); m.step(0x18c5, 13);
    regs.cp(0x53); m.step(0x18c7, 7);
    if (regs.fC) { m.step(0x18cf, 12); return m.call(0x18cf); }
    m.step(0x18c9, 7);
    mem.write8(0x8077, regs.a); m.step(0x18cc, 13);
    m.step(0x19d0, 10); return m.call(0x19d0);
  }

  const m = makeMachine(PATHS.tile_ne_27_jrnz.seed, PATHS.tile_ne_27_jrnz.d);
  loc_186f_mutant(m);
  // With row-bias 0x1e the row store at 0x8073 becomes 0x1e (not 0x1f) AND, because
  // H changes, the pointer shifts off 0x93EB to an unseeded (==0) cell, so the tile
  // read into A is 0x00 rather than 0x10. The control flow is unchanged (0x00 != 0x27
  // still takes jr nz) and the cycle total is identical (add a,n is 7T either way),
  // so it is these value assertions -- A first, then the 0x8073 store -- that reject
  // it. We assert on the A-register divergence, which fires first.
  assert.throws(() => assertPath(m, PATHS.tile_ne_27_jrnz.exp), /A register/);
});
