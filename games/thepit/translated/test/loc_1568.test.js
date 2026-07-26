// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1568 (ROM 0x1568-0x1657): the standalone registered entry
// of the tile-under-object classification ladder. Entered with B = the tile the
// object sits ON, D = the biased screen column (D & 7 = the sub-tile offset), and
// IX = the object's video-RAM cell pointer (for the (IX+1) "tile ahead" read). It
// notes the 0x26/0x27 special tiles, classifies the tile under and (when not
// grid-aligned) the tile ahead, arms the 0xb5 push state on a table mismatch, and
// tail-jumps out to the record builder 0x1b5b or the shared tail 0x1659 -- it has
// NO ret of its own.
//
// The six golden paths below were derived INDEPENDENTLY from the disassembly
// (games/thepit/out/dk.asm) by walking each opcode's length + T-states by hand, then
// cross-checked against loc_1515's byte-identical private copy of the same body.
// Matching them proves the translation charges the ROM's exact cycles and lands
// every m.step on a real instruction boundary. loc_1568 is ENTERED at 0x1568, so the
// first recorded step is 0x1569 (the target of the 0x1568 `ld a,b`), never 0x1568.
//
//   1 solid_defer_2a  : tile 0x2a is "solid" -> the loc_1578 ladder defers via the
//                       first `jp z 0x1b5b`.                                    63 T
//   2 c5_bit2_gate    : tile 0xc5 runs the whole ladder, then `bit 2,d` (clear) ->
//                       jp z 0x1b5b.                                           168 T
//   3 under_push_arm  : aligned pushable tile 0x72 mismatches table 0x1b78 -> arm
//                       0x80a2=1 / 0x80a4 / 0x8069=0xb5 and jp 0x1b5b.         411 T
//   4 ahead_164f_tail : not aligned, under-tile < 0x71 -> loc_15e5 -> the tile
//                       AHEAD (0x9a) routes to loc_164f, whose cross-check matches
//                       and FALLS THROUGH into 0x1659.                         389 T
//   5 under26_record  : tile 0x26 is recorded to 0x8076, then the aligned under-tile
//                       settles via loc_15e5 -> jr z 0x1659.                    214 T
//   6 ahead_push_arm  : not aligned, ahead pushable tile 0x72 mismatches table
//                       0x1ce0 (loc_1616) -> arm the push (loc_163c) + jp 0x1b5b. 563 T
//
// The MUTATION corrupts the entry's `cp 0x26` -> `cp 0x27`: on the tile-0x26 path
// the real routine sees Z, falls through and records 0x8076 = 0x26; the mutant sees
// NZ, takes the jr, and SKIPS the write -- so the step sequence, the cycle total and
// mem[0x8076] all diverge, and assertPath must reject it. The mutant delegates to the
// real loc_1568_1570 for the tail, so the ONLY difference is the mutated compare.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1568, loc_1568_1570 } from "../loc_1568.js";

// Leaf-routine machine double: exactly the surface loc_1568 touches (regs, mem,
// step, call). step records its target + charges cycles; call records the tail-jump
// target WITHOUT running the real callee (0x1b5b / 0x1659 are separate units), so
// `return m.call(target)` models "control transferred there and never came back". A
// real AddressSpace backs mem so the table (0x1b78/0x1ce0) ROM reads and the (ix+1)
// read round-trip faithfully. `rom` seeds ROM bytes (write8 to ROM throws, so they
// must be planted in the backing array before the AddressSpace is built).
function makeMachine({ regs = {}, mem = {}, rom = {} } = {}) {
  const romArr = new Uint8Array(0x5000); // ROM_END + 1
  for (const [addr, val] of Object.entries(rom)) romArr[Number(addr)] = val & 0xff;
  const io = new Io();
  const m = {
    regs: new Regs(),
    io,
    cycles: 0,
    pc: 0x1568,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller
    },
  };
  m.mem = new AddressSpace(romArr, io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(mem)) m.mem.write8(Number(addr), val);
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
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

const PATHS = {
  // 1: tile 0x2a is solid -> the ladder's first `jp z 0x1b5b` defers the frame.
  solid_defer_2a: {
    seed: { regs: { b: 0x2a, d: 0x00 } },
    exp: {
      steps: [0x1569, 0x156b, 0x1570, 0x1571, 0x1573, 0x1578, 0x157a, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: 63,
      pc: 0x1b5b,
      a: 0x2a,
      mem: { 0x8076: 0x00, 0x80e7: 0x00 }, // neither 0x26 nor 0x27 recorded
    },
  },

  // 2: tile 0xc5 walks the entire solid ladder, then `bit 2,d` (bit2 clear) defers.
  c5_bit2_gate: {
    seed: { regs: { b: 0xc5, d: 0x00 } },
    exp: {
      steps: [
        0x1569, 0x156b, 0x1570, 0x1571, 0x1573, 0x1578, 0x157a, 0x157d, 0x157f, 0x1582,
        0x1584, 0x1587, 0x1589, 0x158c, 0x158e, 0x1591, 0x1593, 0x15a2, 0x15a4, 0x1b5b,
      ],
      calls: [0x1b5b],
      returned: false,
      cycles: 168,
      pc: 0x1b5b,
      a: 0xc5,
      mem: { 0x8076: 0x00, 0x80e7: 0x00 },
    },
  },

  // 3: aligned pushable tile 0x72; table 0x1b78[8] = 0x99 != 0x72 -> mismatch, and
  // grid-aligned, so arm the 0xb5 push state and defer. Exercises the sla/rl index
  // math + the 0x1b78 lookup + the push-arm writes.
  under_push_arm: {
    seed: {
      regs: { b: 0x72, d: 0x00 },
      mem: { 0x80a3: 0x5a },
      rom: { 0x1b80: 0x99 }, // 0x1b78 + ((0x72-0x71)<<3 | 0) = 0x1b80
    },
    exp: {
      steps: [
        0x1569, 0x156b, 0x1570, 0x1571, 0x1573, 0x1578, 0x157a, 0x157d, 0x157f, 0x1582,
        0x1584, 0x1587, 0x1589, 0x158c, 0x158e, 0x1591, 0x1593, 0x1595, 0x1597, 0x15a7,
        0x15a9, 0x15ab, 0x15ad, 0x15af, 0x15b0, 0x15b2, 0x15b4, 0x15b6, 0x15b8, 0x15ba,
        0x15bc, 0x15bd, 0x15be, 0x15c0, 0x15c1, 0x15c2, 0x15c5, 0x15c6, 0x15c7, 0x15ca,
        0x15cb, 0x15cd, 0x15ce, 0x15d0, 0x15d2, 0x15d5, 0x15d8, 0x15da, 0x15dd, 0x15df,
        0x15e2, 0x1b5b,
      ],
      calls: [0x1b5b],
      returned: false,
      cycles: 411,
      pc: 0x1b5b,
      a: 0xb5,
      mem: { 0x80a7: 0x99, 0x80a4: 0x5a, 0x80a2: 0x01, 0x8069: 0xb5 },
    },
  },

  // 4: under-tile 0x30 (< 0x71) is not-aligned (D&7=2) -> loc_15e5 -> tile ahead
  // (IX+1)=0x9a routes to loc_164f; its cross-check (0x80a7 == 0x80a5) matches and
  // FALLS THROUGH into 0x1659. Exercises loc_15ea/loc_164f + the fall-through hand-off.
  ahead_164f_tail: {
    seed: {
      regs: { b: 0x30, d: 0x02, ix: 0x8100 },
      mem: { 0x8101: 0x9a, 0x80a5: 0x40, 0x80a7: 0x40 },
    },
    exp: {
      steps: [
        0x1569, 0x156b, 0x1570, 0x1571, 0x1573, 0x1578, 0x157a, 0x157d, 0x157f, 0x1582,
        0x1584, 0x1587, 0x1589, 0x158c, 0x158e, 0x1591, 0x1593, 0x1595, 0x1597, 0x15a7,
        0x15a9, 0x15e5, 0x15e6, 0x15e8, 0x15ea, 0x15ed, 0x15f0, 0x15f2, 0x15f5, 0x15f7,
        0x15fa, 0x15fc, 0x15ff, 0x1601, 0x1603, 0x1605, 0x1608, 0x160a, 0x160c, 0x160e,
        0x164f, 0x1652, 0x1653, 0x1656, 0x1657, 0x1659,
      ],
      calls: [0x1659],
      returned: false,
      cycles: 389,
      pc: 0x1659,
      a: 0x40,
      mem: { 0x80a6: 0x9a, 0x80a7: 0x40 }, // ahead recorded; under record unchanged
    },
  },

  // 5: tile 0x26 is recorded to 0x8076, then the aligned (D&7=0) under-tile < 0x71
  // settles at loc_15e5 and hands off to the shared tail 0x1659.
  under26_record: {
    seed: { regs: { b: 0x26, d: 0x00 } },
    exp: {
      steps: [
        0x1569, 0x156b, 0x156d, 0x1570, 0x1571, 0x1573, 0x1578, 0x157a, 0x157d, 0x157f,
        0x1582, 0x1584, 0x1587, 0x1589, 0x158c, 0x158e, 0x1591, 0x1593, 0x1595, 0x1597,
        0x15a7, 0x15a9, 0x15e5, 0x15e6, 0x15e8, 0x1659,
      ],
      calls: [0x1659],
      returned: false,
      cycles: 214,
      pc: 0x1659,
      a: 0x00, // last op is `and 0x07` on D=0
      mem: { 0x8076: 0x26 },
    },
  },

  // 6: not-aligned; the tile ahead (IX+1)=0x72 is pushable, mismatches table 0x1ce0
  // (0x1cea = 0x88 != 0x72) at loc_1616 -> arm the push via loc_163c and defer.
  // Exercises the second table + loc_1616/loc_163c.
  ahead_push_arm: {
    seed: {
      regs: { b: 0x30, d: 0x02, ix: 0x8100 },
      mem: { 0x8101: 0x72, 0x80a3: 0x5a },
      rom: { 0x1cea: 0x88 }, // 0x1ce0 + ((0x72-0x71)<<3 | (0x02&7)) = 0x1ce0 + 0x0a
    },
    exp: {
      steps: [
        0x1569, 0x156b, 0x1570, 0x1571, 0x1573, 0x1578, 0x157a, 0x157d, 0x157f, 0x1582,
        0x1584, 0x1587, 0x1589, 0x158c, 0x158e, 0x1591, 0x1593, 0x1595, 0x1597, 0x15a7,
        0x15a9, 0x15e5, 0x15e6, 0x15e8, 0x15ea, 0x15ed, 0x15f0, 0x15f2, 0x15f5, 0x15f7,
        0x15fa, 0x15fc, 0x15ff, 0x1601, 0x1603, 0x1605, 0x1608, 0x160a, 0x1616, 0x1618,
        0x161a, 0x161c, 0x161e, 0x161f, 0x1621, 0x1623, 0x1625, 0x1627, 0x1629, 0x162b,
        0x162c, 0x162d, 0x162f, 0x1630, 0x1631, 0x1634, 0x1635, 0x1636, 0x1639, 0x163a,
        0x163c, 0x163f, 0x1642, 0x1644, 0x1647, 0x1649, 0x164c, 0x1b5b,
      ],
      calls: [0x1b5b],
      returned: false,
      cycles: 563,
      pc: 0x1b5b,
      a: 0xb5,
      mem: { 0x80a8: 0x88, 0x80a6: 0x72, 0x80a4: 0x5a, 0x80a2: 0x01, 0x8069: 0xb5 },
    },
  },
};

for (const [name, { seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed);
    loc_1568(m);
    assertPath(m, exp);
  });
}

// Sanity anchor: the 0x1b78 table byte genuinely DRIVES the match/mismatch branch.
// Path 3 mismatched (table 0x1b80 = 0x99) and armed the push; flipping that byte to
// the tile id 0x72 makes `cp e` match, so the routine takes `jr z 0x15e5` instead --
// no push is armed and it hands off to 0x1659, not 0x1b5b.
test("table 0x1b78 lookup drives the branch: a match skips the push arm", () => {
  const m = makeMachine({ regs: { b: 0x72, d: 0x00 }, rom: { 0x1b80: 0x72 } });
  loc_1568(m);
  assert.deepEqual(m.calls, [0x1659], "matched -> settles at 0x1659, not the 0x1b5b arm");
  assert.equal(m.mem.read8(0x80a7), 0x72, "the looked-up (matching) tile was stored");
  assert.equal(m.mem.read8(0x8069), 0x00, "no push handler armed on a match");
  assert.equal(m.mem.read8(0x80a2), 0x00, "no push flag set on a match");
});

test("mutation: cp 0x26 -> cp 0x27 fails to record tile 0x26 and is caught", () => {
  // Byte-identical to loc_1568's entry except `cp 0x26` becomes `cp 0x27`, then it
  // delegates to the REAL loc_1568_1570 for the tail. On the tile-0x26 path the real
  // routine sees Z, does not take the jr, and records 0x8076 = 0x26; the mutant sees
  // NZ, takes the jr, and skips the write -- diverging in the step sequence, the
  // cycle total, and mem[0x8076].
  function loc_1568_mutant(m) {
    const { regs, mem } = m;
    regs.a = regs.b;
    m.step(0x1569, 4); // ld a,b
    regs.cp(0x27); // BUG: should be `cp 0x26`
    m.step(0x156b, 7);
    if (regs.fNZ) {
      m.step(0x1570, 12); // jr nz taken
      return loc_1568_1570(m);
    }
    m.step(0x156d, 7); // jr nz not taken
    mem.write8(0x8076, regs.a);
    m.step(0x1570, 13);
    return loc_1568_1570(m);
  }

  const m = makeMachine(PATHS.under26_record.seed);
  loc_1568_mutant(m);
  assert.equal(m.mem.read8(0x8076), 0x00, "mutant skips the tile-0x26 record");
  assert.throws(
    () => assertPath(m, PATHS.under26_record.exp),
    /step targets/,
    "the step-target assertion catches the corrupted compare",
  );
});
