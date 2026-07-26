// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_3984 (ROM 0x3984-0x3a12, The Pit): the one-shot spawn/init
// of a two-record actor, gated on the request flag 0x810d. It drives both control
// paths -- the `ret z` early exit when 0x810d == 0 (nothing drawn, nothing seeded)
// and the full spawn path when it is non-zero (8-cell tile block into video+colour
// RAM, both 17-byte object records seeded, tail-jump to 0x3a4c) -- asserting the
// exact T-state total, the instruction-boundary step sequence, the tail-jump vs.
// real-ret control flow, the final PC/A/B/IX/IY, and every memory byte written.
// A MUTATION corrupts the colour byte (0x93 -> 0x94) and proves the value
// assertions catch it even though the cycle total is unchanged (ld b,n is 7T
// either way, so cycles cannot see it).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3984 } from "../loc_3984.js";

// Leaf-routine machine double: exactly the surface loc_3984 touches (regs, mem,
// step, ret, call). `step` records target + charges cycles; `ret` records a REAL
// return (and charges its T-states); `call` records a transfer target WITHOUT
// invoking a routine -- for a tail-jump `return m.call(addr)` models "control
// transferred there and never came back".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x3984,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller (tail-jump)
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
  assert.equal(m.returned, exp.returned ?? false, "direct ret?");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  if (exp.b !== undefined) assert.equal(m.regs.b, exp.b, "B register");
  if (exp.ix !== undefined) assert.equal(m.regs.ix, exp.ix, "IX register");
  if (exp.iy !== undefined) assert.equal(m.regs.iy, exp.iy, "IY register");
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// --- The full spawn-path step sequence (0x810d != 0), 58 instruction boundaries.
const SPAWN_STEPS = [
  0x3987, 0x3988, 0x3989, 0x398b, 0x398e, 0x3991, 0x3995, 0x3999, 0x399b, 0x399d,
  0x39a0, 0x39a3, 0x39a4, 0x39a7, 0x39aa, 0x39ab, 0x39ae, 0x39b1, 0x39b2, 0x39b5,
  0x39b8, 0x39b9, 0x39bc, 0x39bf, 0x39c0, 0x39c3, 0x39c6, 0x39c7, 0x39ca, 0x39cd,
  0x39ce, 0x39d1, 0x39d4, 0x39d6, 0x39d9, 0x39dc, 0x39de, 0x39e1, 0x39e4, 0x39e7,
  0x39ea, 0x39ed, 0x39f0, 0x39f2, 0x39f5, 0x39f8, 0x39fa, 0x39fd, 0x39fe, 0x3a01,
  0x3a04, 0x3a06, 0x3a07, 0x3a09, 0x3a0a, 0x3a0d, 0x3a10, 0x3a4c,
];

// Every byte the spawn path writes. Video tiles 0xa8..0xaf at IX=0x90e4's eight
// offsets; colour 0x93 at IY=0x88e4's eight offsets; then the two object records.
const SPAWN_MEM = {
  // video RAM, tiles 0xa8..0xaf (row stride 0x20, columns +0/+1)
  0x9084: 0xa8, 0x9085: 0xa9,
  0x90a4: 0xaa, 0x90a5: 0xab,
  0x90c4: 0xac, 0x90c5: 0xad,
  0x90e4: 0xae, 0x90e5: 0xaf,
  // colour RAM, constant 0x93
  0x8884: 0x93, 0x8885: 0x93,
  0x88a4: 0x93, 0x88a5: 0x93,
  0x88c4: 0x93, 0x88c5: 0x93,
  0x88e4: 0x93, 0x88e5: 0x93,
  // primary record (0x810a) + twin (0x811b, +0x11)
  0x810d: 0x00, 0x811e: 0x00, // request flag + mirror cleared
  0x810b: 0x09, 0x811c: 0x09, // tile field
  0x810a: 0x00, 0x811b: 0x00,
  0x810c: 0x00, 0x811d: 0x00,
  0x8117: 0x00, 0x8128: 0x00,
  0x8112: 0xb4, 0x8123: 0xb4, // timer
  0x811a: 0x06, 0x812b: 0x07, // twin is +1 here
  0x8118: 0x03, 0x8129: 0x03, // 0x07 - (0x8028 & 0x06); 0x8028=0x05 -> &6=0x04 -> 0x03
};

// --- Path A: request flag 0x810d == 0 -> `ret z`, no draw, no seed --------------
test("path A: 0x810d == 0 -> ret z, nothing drawn or seeded", () => {
  const m = makeMachine({ 0x810d: 0x00, 0x9084: 0x55, 0x810b: 0x55 });
  loc_3984(m);
  assertPath(m, {
    steps: [0x3987, 0x3988],
    calls: [],
    returned: true, // a real ret to the caller, NOT a tail-jump
    cycles: 13 + 4 + 11, // 28
    pc: 0x3988, // last step; the machine double's ret does not move PC
    a: 0x00, // and a of 0
    mem: { 0x810d: 0x00, 0x9084: 0x55, 0x810b: 0x55 }, // untouched
  });
});

// --- Path B: request flag non-zero -> full spawn, tail-jump 0x3a4c ---------------
test("path B: 0x810d != 0 -> draw 8-cell block + seed both records -> tail 0x3a4c", () => {
  const m = makeMachine({ 0x810d: 0x01, 0x8028: 0x05 });
  loc_3984(m);
  assertPath(m, {
    steps: SPAWN_STEPS,
    calls: [0x3a4c],
    returned: false, // tail-jump, not a direct ret
    cycles: 688,
    pc: 0x3a4c,
    a: 0x03, // 0x07 - (0x8028 & 0x06) = 0x07 - 0x04
    b: 0x04, // 0x8028 & 0x06
    ix: 0x90e4,
    iy: 0x88e4,
    mem: SPAWN_MEM,
  });
});

// --- 0x8028 start-value derivation: mask keeps only bits 1..2 -------------------
test("0x8118/0x8129 = 0x07 - (0x8028 & 0x06); low/high bits are masked off", () => {
  const m = makeMachine({ 0x810d: 0x01, 0x8028: 0xf9 }); // 0xf9 & 0x06 = 0x00 -> 0x07
  loc_3984(m);
  assert.equal(m.mem.read8(0x8118), 0x07, "0xf9 masks to 0 -> 0x07");
  assert.equal(m.mem.read8(0x8129), 0x07, "twin matches");
  assert.equal(m.regs.b, 0x00, "B = 0xf9 & 0x06");
});

// --- Mutation: colour byte 0x93 -> 0x94, cycles unchanged (ld b,n is 7T) ---------
test("mutation: colour byte 0x94 for 0x93 is caught by the value assertions", () => {
  // Byte-identical to loc_3984 except `ld b,0x93` (0x3999) loads 0x94. Every IY
  // (colour) write then stamps 0x94, so the colour RAM assertions reject it while
  // the cycle total stays exactly 688 (ld b,n costs 7T for any immediate).
  function loc_3984_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x810d); m.step(0x3987, 13);
    regs.and(regs.a); m.step(0x3988, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x3989, 5);
    regs.a = 0x00; m.step(0x398b, 7);
    mem.write8(0x810d, regs.a); m.step(0x398e, 13);
    mem.write8(0x811e, regs.a); m.step(0x3991, 13);
    regs.ix = 0x90e4; m.step(0x3995, 14);
    regs.iy = 0x88e4; m.step(0x3999, 14);
    regs.b = 0x94; m.step(0x399b, 7); // BUG: should be 0x93
    regs.a = 0xa8; m.step(0x399d, 7);
    mem.write8((regs.ix - 0x60) & 0xffff, regs.a); m.step(0x39a0, 19);
    mem.write8((regs.iy - 0x60) & 0xffff, regs.b); m.step(0x39a3, 19);
    regs.a = regs.inc8(regs.a); m.step(0x39a4, 4);
    mem.write8((regs.ix - 0x5f) & 0xffff, regs.a); m.step(0x39a7, 19);
    mem.write8((regs.iy - 0x5f) & 0xffff, regs.b); m.step(0x39aa, 19);
    regs.a = regs.inc8(regs.a); m.step(0x39ab, 4);
    mem.write8((regs.ix - 0x40) & 0xffff, regs.a); m.step(0x39ae, 19);
    mem.write8((regs.iy - 0x40) & 0xffff, regs.b); m.step(0x39b1, 19);
    regs.a = regs.inc8(regs.a); m.step(0x39b2, 4);
    mem.write8((regs.ix - 0x3f) & 0xffff, regs.a); m.step(0x39b5, 19);
    mem.write8((regs.iy - 0x3f) & 0xffff, regs.b); m.step(0x39b8, 19);
    regs.a = regs.inc8(regs.a); m.step(0x39b9, 4);
    mem.write8((regs.ix - 0x20) & 0xffff, regs.a); m.step(0x39bc, 19);
    mem.write8((regs.iy - 0x20) & 0xffff, regs.b); m.step(0x39bf, 19);
    regs.a = regs.inc8(regs.a); m.step(0x39c0, 4);
    mem.write8((regs.ix - 0x1f) & 0xffff, regs.a); m.step(0x39c3, 19);
    mem.write8((regs.iy - 0x1f) & 0xffff, regs.b); m.step(0x39c6, 19);
    regs.a = regs.inc8(regs.a); m.step(0x39c7, 4);
    mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x39ca, 19);
    mem.write8((regs.iy + 0x00) & 0xffff, regs.b); m.step(0x39cd, 19);
    regs.a = regs.inc8(regs.a); m.step(0x39ce, 4);
    mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x39d1, 19);
    mem.write8((regs.iy + 0x01) & 0xffff, regs.b); m.step(0x39d4, 19);
    regs.a = 0x09; m.step(0x39d6, 7);
    mem.write8(0x810b, regs.a); m.step(0x39d9, 13);
    mem.write8(0x811c, regs.a); m.step(0x39dc, 13);
    regs.a = 0x00; m.step(0x39de, 7);
    mem.write8(0x810a, regs.a); m.step(0x39e1, 13);
    mem.write8(0x811b, regs.a); m.step(0x39e4, 13);
    mem.write8(0x810c, regs.a); m.step(0x39e7, 13);
    mem.write8(0x811d, regs.a); m.step(0x39ea, 13);
    mem.write8(0x8117, regs.a); m.step(0x39ed, 13);
    mem.write8(0x8128, regs.a); m.step(0x39f0, 13);
    regs.a = 0xb4; m.step(0x39f2, 7);
    mem.write8(0x8112, regs.a); m.step(0x39f5, 13);
    mem.write8(0x8123, regs.a); m.step(0x39f8, 13);
    regs.a = 0x06; m.step(0x39fa, 7);
    mem.write8(0x811a, regs.a); m.step(0x39fd, 13);
    regs.a = regs.inc8(regs.a); m.step(0x39fe, 4);
    mem.write8(0x812b, regs.a); m.step(0x3a01, 13);
    regs.a = mem.read8(0x8028); m.step(0x3a04, 13);
    regs.and(0x06); m.step(0x3a06, 7);
    regs.b = regs.a; m.step(0x3a07, 4);
    regs.a = 0x07; m.step(0x3a09, 7);
    regs.sub(regs.b); m.step(0x3a0a, 4);
    mem.write8(0x8118, regs.a); m.step(0x3a0d, 13);
    mem.write8(0x8129, regs.a); m.step(0x3a10, 13);
    m.step(0x3a4c, 10); return m.call(0x3a4c);
  }

  const m = makeMachine({ 0x810d: 0x01, 0x8028: 0x05 });
  loc_3984_mutant(m);
  // Cycles identical to the real Path B, so only value checks can reject it.
  assert.equal(m.cycles, 688, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.equal(m.mem.read8(0x88e4), 0x94, "mutant colour cell = 0x94, not 0x93");
  assert.throws(
    () =>
      assertPath(m, {
        steps: SPAWN_STEPS,
        calls: [0x3a4c],
        cycles: 688,
        pc: 0x3a4c,
        a: 0x03,
        mem: { 0x88e4: 0x93 }, // the correct colour byte the real routine writes
      }),
    /mem\[0x88e4\]/,
  );
});
