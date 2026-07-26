// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_16b9 (ROM 0x16b9-0x1703): the row-index common path from
// loc_167f. HEAD tests the "already-latched" flag at 0x80e7 and the caller code in
// L; the C4 block turns the column at 0x806b and the row in H into a tilemap
// pointer (0x9000 + row*0x20 + col>>3), stores it to 0x806e, loads IX from it, and
// compares the cells (ix+0x01) and (ix+0x21) against the 0x27 terminator; the FB
// block latches A into 0x80e7 and 0x8077, then tail-jumps 0x19d0.
//
// Four reachable exits are driven:
//   A) mem[0x80e7]!=0 & L==0x17            -> FB via 16c2, A stays L (0x17)
//   B) mem[0x80e7]==0, (ix+0x01)==0x27     -> FB via 16f2, A = 0x27
//   C) mem[0x80e7]!=0 & L!=0x17, neither cell 0x27 -> tail-jump loc_1704, A = cell
//   D) mem[0x80e7]==0, (ix+0x01)!=0x27 but (ix+0x21)==0x27 -> FB via 16f9 fall-thru
// Between them they cover every branch (both HEAD arms, both jr z at 16c2/16f2, and
// both edges of the 16f9 jr nz). With col=0/H=0 the pointer lands at IX=0x9000, so
// the two peeked cells are mem[0x9001] and mem[0x9021] (seeded per path).
//
// 0x1704 and 0x19d0 are separate units; the machine double records `m.call(t)`
// WITHOUT invoking them, modelling "control transferred to t and never came back".
//
// The MUTATION corrupts the closing `jr nz,0x1704` tail-jump target to 0x1705. A jr
// taken is 12T regardless of target, so the cycle total is UNCHANGED -- it is the
// step/call-target assertions (the loc_167f discipline) that must reject it, which
// also proves the routine-boundary tail-call to loc_1704 is pinned to the address.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_16b9 } from "../loc_16b9.js";

// Minimal leaf-routine machine double: exactly the surface loc_16b9 touches (regs,
// mem, step, ret, call). step records its target + charges cycles; call records the
// tail-jump target WITHOUT invoking a real routine. H and L are register inputs
// (loc_167f leaves the row in H and a state code in L), settable via `regs`.
function makeMachine(seed = {}, regs = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x16b9,
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
  for (const [k, v] of Object.entries(regs)) m.regs[k] = v;
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.equal(m.returned, exp.returned, "early ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [addr, val] of Object.entries(exp.mem ?? {})) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// Instruction blocks as [stepTarget, tstates] pairs; `seq` concatenates them into
// the expected {steps, cycles}. Each pair is one Z80 instruction (its next-boundary
// address + exact T-states), so the cycle total is derived, never hand-summed.
const HEAD2 = [[0x16bc, 13], [0x16bd, 4]]; // ld a,(0x80e7) / and a
const HEADA = [[0x16c4, 12]];              // jr z taken  -> C4
const HEADB = [[0x16bf, 7], [0x16c0, 4], [0x16c2, 7], [0x16c4, 7]]; // else, L!=0x17 -> C4
const HEADP1 = [[0x16bf, 7], [0x16c0, 4], [0x16c2, 7], [0x16fb, 12]]; // else, L==0x17 -> FB
const C4 = [
  [0x16c7, 13], [0x16c9, 7], [0x16ca, 4], [0x16cc, 8], [0x16ce, 8], [0x16d0, 8],
  [0x16d3, 13], [0x16d4, 4], [0x16d6, 7], [0x16d7, 4], [0x16d9, 8], [0x16da, 4],
  [0x16dc, 8], [0x16dd, 4], [0x16df, 8], [0x16e0, 4], [0x16e1, 4], [0x16e2, 11],
  [0x16e5, 10], [0x16e6, 11], [0x16e9, 16], [0x16ed, 20], [0x16f0, 19], [0x16f2, 7],
];
const F2TAKEN = [[0x16fb, 12]];                             // jr z taken -> FB
const F2NOT = [[0x16f4, 7], [0x16f7, 19], [0x16f9, 7]];     // fall past 16f2, load ix+0x21, cp
const F9TAKEN = [[0x1704, 12]];                             // jr nz taken -> call loc_1704
const F9NOT = [[0x16fb, 7]];                                // jr nz not taken -> fall into FB
const FB = [[0x16fe, 13], [0x1701, 13], [0x19d0, 10]];      // FB block + jp 0x19d0

function seq(...blocks) {
  const flat = blocks.flat();
  return { steps: flat.map((p) => p[0]), cycles: flat.reduce((s, p) => s + p[1], 0) };
}

const PATHS = {
  // A) latched flag set, L already the terminator sprite -> FB with A = L.
  head_L17_fb: {
    seed: { 0x80e7: 0x01 },
    regs: { l: 0x17 },
    exp: {
      ...seq(HEAD2, HEADP1, FB),
      calls: [0x19d0],
      returned: false,
      pc: 0x19d0,
      a: 0x17,
      mem: { 0x80e7: 0x17, 0x8077: 0x17 },
    },
  },
  // B) flag clear -> pointer build; (ix+0x01)==0x27 -> FB with A = 0x27.
  headA_cell1_fb: {
    seed: { 0x80e7: 0x00, 0x806b: 0x00, 0x9001: 0x27 },
    regs: { h: 0x00 },
    exp: {
      ...seq(HEAD2, HEADA, C4, F2TAKEN, FB),
      calls: [0x19d0],
      returned: false,
      pc: 0x19d0,
      a: 0x27,
      mem: { 0x8071: 0x00, 0x806e: 0x00, 0x806f: 0x90, 0x80e7: 0x27, 0x8077: 0x27 },
    },
  },
  // C) flag set but L!=0x17 (HEAD fall-through), neither cell 0x27 -> tail-jump loc_1704.
  headB_neither_1704: {
    seed: { 0x80e7: 0x05, 0x806b: 0x00, 0x9001: 0x00, 0x9021: 0x00 },
    regs: { l: 0x10, h: 0x00 },
    exp: {
      ...seq(HEAD2, HEADB, C4, F2NOT, F9TAKEN),
      calls: [0x1704],
      returned: false,
      pc: 0x1704,
      a: 0x00,
      // FB NOT taken: 0x80e7 keeps its seed, 0x8077 untouched.
      mem: { 0x8071: 0x00, 0x806e: 0x00, 0x806f: 0x90, 0x80e7: 0x05, 0x8077: 0x00 },
    },
  },
  // D) flag clear, (ix+0x01)!=0x27 but (ix+0x21)==0x27 -> FB via the 16f9 fall-through.
  headA_cell2_fb: {
    seed: { 0x80e7: 0x00, 0x806b: 0x00, 0x9001: 0x00, 0x9021: 0x27 },
    regs: { h: 0x00 },
    exp: {
      ...seq(HEAD2, HEADA, C4, F2NOT, F9NOT, FB),
      calls: [0x19d0],
      returned: false,
      pc: 0x19d0,
      a: 0x27,
      mem: { 0x80e7: 0x27, 0x8077: 0x27 },
    },
  },
};

for (const [name, { seed, regs, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed, regs);
    loc_16b9(m);
    assertPath(m, exp);
  });
}

// Anchor the pointer arithmetic itself: with col=0/H=0 the routine really writes
// 0x9000 to 0x806e (low byte first), which is what makes IX land on 0x9000.
test("VRAM pointer 0x9000 + row*0x20 + col>>3 is stored to 0x806e", () => {
  const m = makeMachine({ 0x80e7: 0x00, 0x806b: 0x00, 0x9001: 0x00, 0x9021: 0x00 }, { h: 0x00 });
  loc_16b9(m);
  assert.equal(m.mem.read16(0x806e), 0x9000, "pointer word at 0x806e");
});

// The row in H genuinely participates: the `srl h / rra` groups reassemble H << 5,
// so one row (H+=1) is a 0x20 tilemap stride.
test("H (the tile row) shifts the pointer by 0x20 per row", () => {
  const base = makeMachine({ 0x80e7: 0x00, 0x806b: 0x00, 0x9001: 0x00, 0x9021: 0x00 }, { h: 0x00 });
  loc_16b9(base);
  const bumped = makeMachine({ 0x80e7: 0x00, 0x806b: 0x00, 0x9001: 0x00, 0x9021: 0x00 }, { h: 0x01 });
  loc_16b9(bumped);
  assert.equal(bumped.mem.read16(0x806e) - base.mem.read16(0x806e), 0x20, "H+=1 -> pointer += 0x20");
});

test("mutation: a corrupted jr-nz-0x1704 tail-jump target is caught", () => {
  // Byte-identical to loc_16b9 through the 16f9 arm, except the tail-jump targets
  // 0x1705 instead of 0x1704. A jr taken is 12T regardless of target, so the cycle
  // total is UNCHANGED; the step/call-target assertions are what must reject it.
  function fb(m) {
    const { regs, mem } = m;
    mem.write8(0x80e7, regs.a);
    m.step(0x16fe, 13);
    mem.write8(0x8077, regs.a);
    m.step(0x1701, 13);
    m.step(0x19d0, 10);
    return m.call(0x19d0);
  }
  function loc_16b9_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x80e7);
    m.step(0x16bc, 13);
    regs.and(regs.a);
    m.step(0x16bd, 4);
    if (regs.fZ) {
      m.step(0x16c4, 12);
    } else {
      m.step(0x16bf, 7);
      regs.a = regs.l;
      m.step(0x16c0, 4);
      regs.cp(0x17);
      m.step(0x16c2, 7);
      if (regs.fZ) {
        m.step(0x16fb, 12);
        return fb(m);
      }
      m.step(0x16c4, 7);
    }
    regs.a = mem.read8(0x806b);
    m.step(0x16c7, 13);
    regs.add(0x05);
    m.step(0x16c9, 7);
    regs.d = regs.a;
    m.step(0x16ca, 4);
    regs.a = regs.srl(regs.a);
    m.step(0x16cc, 8);
    regs.a = regs.srl(regs.a);
    m.step(0x16ce, 8);
    regs.a = regs.srl(regs.a);
    m.step(0x16d0, 8);
    mem.write8(0x8071, regs.a);
    m.step(0x16d3, 13);
    regs.c = regs.a;
    m.step(0x16d4, 4);
    regs.a = 0x00;
    m.step(0x16d6, 7);
    regs.b = regs.a;
    m.step(0x16d7, 4);
    regs.h = regs.srl(regs.h);
    m.step(0x16d9, 8);
    regs.rra();
    m.step(0x16da, 4);
    regs.h = regs.srl(regs.h);
    m.step(0x16dc, 8);
    regs.rra();
    m.step(0x16dd, 4);
    regs.h = regs.srl(regs.h);
    m.step(0x16df, 8);
    regs.rra();
    m.step(0x16e0, 4);
    regs.l = regs.a;
    m.step(0x16e1, 4);
    regs.addHl(regs.bc);
    m.step(0x16e2, 11);
    regs.bc = 0x9000;
    m.step(0x16e5, 10);
    regs.addHl(regs.bc);
    m.step(0x16e6, 11);
    mem.write16(0x806e, regs.hl);
    m.step(0x16e9, 16);
    regs.ix = mem.read16(0x806e);
    m.step(0x16ed, 20);
    regs.a = mem.read8((regs.ix + 0x01) & 0xffff);
    m.step(0x16f0, 19);
    regs.cp(0x27);
    m.step(0x16f2, 7);
    if (regs.fZ) {
      m.step(0x16fb, 12);
      return fb(m);
    }
    m.step(0x16f4, 7);
    regs.a = mem.read8((regs.ix + 0x21) & 0xffff);
    m.step(0x16f7, 19);
    regs.cp(0x27);
    m.step(0x16f9, 7);
    if (regs.fNZ) {
      m.step(0x1705, 12); // BUG: should be 0x1704
      return m.call(0x1705); // BUG: should be 0x1704
    }
    m.step(0x16fb, 7);
    return fb(m);
  }

  const { seed, regs } = PATHS.headB_neither_1704;
  const m = makeMachine(seed, regs);
  loc_16b9_mutant(m);
  // Only the tail-jump target differs; cycles are identical, so the step-target
  // assertion is what must throw.
  assert.equal(m.cycles, PATHS.headB_neither_1704.exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, PATHS.headB_neither_1704.exp), /step targets/);
});
