// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1704 (ROM 0x1704-0x1869): the tile/terrain interaction
// handler. The routine is a graph of basic blocks whose every non-consumed exit
// is a TAIL-jump to 0x1b5b, with two nested score `call`s (0x467b / 0x4683). The
// test drives three representative paths through it --
//   A: off-grid, tile 0x2a -> classified solid -> tail 0x1b5b (loc_1763);
//   B: on-grid collectible 0x3a -> call 0x467b, consume via loc_174f (ix reload +
//      blank cell), walk-step math loc_184a -> loc_1864 -> tail 0x1b5b;
//   C: on-grid, tile 0x91 -> the loc_1798 direction-indexed table check with a
//      non-trivial sla/rl (carry into B), table mismatch -> arm 0x35 event -> tail.
// Each asserts the exact T-state total, the instruction-boundary step sequence,
// the tail-jump / call targets, the pushed return address(es), the final PC / A /
// key registers, and every memory byte written. It then re-runs a FULL copy whose
// `ld a,0x70` (the blank-cell value at 0x1753) is corrupted to `ld a,0x60` and
// proves the value assertions catch it even though the cycle total is unchanged
// (ld a,n is 7T either way and control flow is identical).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1704 } from "../loc_1704.js";

// Leaf-routine machine double: exactly the surface loc_1704 touches (regs, mem,
// step, call, ret, push16). `step` records its target + charges cycles; `call`
// records a transfer target WITHOUT invoking a real routine -- for a tail-jump
// `return m.call(addr)` models "control transferred there and never came back",
// and for the score `call`s the callee's own effects are irrelevant here (the
// routine reads no value back from them). `push16` records the stacked return.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; the table reads land in this (zero) ROM
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1704,
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
      return undefined; // tail-jump: callee's ret returns to OUR caller; score calls read nothing back
    },
    push16(value) {
      this.pushes.push(value);
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
  assert.deepEqual(m.pushes, exp.pushes ?? [], "pushed return addresses");
  assert.equal(m.returned, exp.returned ?? false, "direct ret?");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  for (const [reg, val] of Object.entries(exp.regs ?? {})) {
    assert.equal(m.regs[reg], val, `${reg} register`);
  }
  for (const [addr, val] of Object.entries(exp.mem)) {
    assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
  }
}

// --- Path A: off-grid step, tile 0x2a -> solid -> tail 0x1b5b (via loc_1763) -----
test("path A: off-grid, tile 0x2a classified solid -> tail-jump 0x1b5b", () => {
  const m = makeMachine({ 0x8100: 0x2a }); // (ix+0) = 0x2a
  m.regs.ix = 0x8100;
  m.regs.d = 0x01; // d & 7 = 1 -> off-grid -> jr nz at 0x1716
  loc_1704(m);
  assertPath(m, {
    steps: [
      0x1706, 0x1709, 0x170c, 0x170f, 0x1712, 0x1713, 0x1714, 0x1716, 0x175b, // entry: jr nz taken -> loc_175b
      0x175c, 0x175e, 0x1763, // loc_175b: cp 0x26 NZ -> jr nz taken (skips 0x8076 store)
      0x1764, 0x1766, 0x1b5b, // loc_1763: cp 0x2a Z -> jp z tail
    ],
    calls: [0x1b5b],
    cycles:
      /* entry */ 7 + 13 + 19 + 13 + 13 + 4 + 4 + 7 + 12 + // 92
      /* 175b  */ 4 + 7 + 12 + // 23
      /* 1763  */ 4 + 7 + 10, // 21  => 136
    pc: 0x1b5b,
    a: 0x2a,
    mem: {
      0x80a8: 0x00, // pre-cleared
      0x80a5: 0x2a, // saved tile
      0x80a7: 0x2a, // saved tile (never table-overwritten on this path)
      0x8076: 0x00, // NOT stashed (tile != 0x26)
    },
  });
});

// --- Path B: on-grid collectible 0x3a -> +10 call, consume, walk-step -> tail ----
const PATH_B_STEPS = [
  0x1706, 0x1709, 0x170c, 0x170f, 0x1712, 0x1713, 0x1714, 0x1716, // entry: jr nz NOT taken (on grid)
  0x1718, 0x1719, 0x171b, 0x171d, // ld a,b / cp 0x3a / jr nz NOT taken (== 0x3a)
  0x467b, 0x1723, 0x1724, 0x1727, // call 0x467b, bump 0x8081, jr 0x174f
  0x174f, 0x1753, 0x1755, 0x1758, // loc_174f: ix reload, ld a,0x70, blank cell, jp 0x184a
  0x184a, 0x184d, 0x184e, 0x1851, 0x1852, 0x1855, 0x1857, 0x1859, 0x185c, 0x185e, 0x1860, // loc_184a
  0x1864, 0x1867, 0x1b5b, // loc_1864: store code, tail
];
test("path B: on-grid 0x3a collectible -> call 0x467b, consume, walk-step -> tail 0x1b5b", () => {
  const m = makeMachine({
    0x8100: 0x3a, // (ix+0) collectible
    0x8081: 0x10, // 0x3a counter
    0x806e: 0x00, 0x806f: 0x82, // display-cell pointer -> 0x8200
    0x806c: 0x01, // per-step delta
    0x8068: 0x00, // animation phase
  });
  m.regs.ix = 0x8100;
  m.regs.d = 0x00; // on grid
  loc_1704(m);
  assertPath(m, {
    steps: PATH_B_STEPS,
    calls: [0x467b, 0x1b5b], // nested score call, then the tail-jump
    pushes: [0x1720], // the +10 CALL stacks its return address
    cycles:
      /* entry */ 7 + 13 + 19 + 13 + 13 + 4 + 4 + 7 + 7 + // 87
      /* 3a arm*/ 4 + 7 + 7 + 17 + 13 + 4 + 13 + 12 + // 77
      /* 174f  */ 20 + 7 + 19 + 10 + // 56
      /* 184a  */ 13 + 4 + 13 + 4 + 13 + 7 + 7 + 13 + 7 + 7 + 12 + // 100
      /* 1864  */ 13 + 10, // 23  => 343
    pc: 0x1b5b,
    a: 0x32, // (phase+delta+3)&7 = 4; 4 & 2 = 0 -> code 0x32
    regs: { ix: 0x8200 }, // reloaded from 0x806e
    mem: {
      0x80a5: 0x3a,
      0x80a7: 0x3a,
      0x8081: 0x11, // counter bumped
      0x8200: 0x70, // consumed cell blanked to 0x70
      0x8068: 0x01, // phase advanced 0x00 + 0x01
      0x8075: 0x04, // (0x01 + 3) & 7
      0x8069: 0x32, // sprite code (bit1 clear)
    },
  });
});

// --- Path C: on-grid, tile 0x91 -> loc_1798 table check (sla/rl, carry into B),
//     mismatch -> arm 0x35 event -> tail 0x1b5b. ----------------------------------
const PATH_C_STEPS = [
  0x1706, 0x1709, 0x170c, 0x170f, 0x1712, 0x1713, 0x1714, 0x1716, // entry: jr nz NOT taken
  0x1718, 0x1719, 0x171b, 0x1729, // cp 0x3a NZ -> jr nz taken -> loc_1729
  0x172b, 0x172d, 0x172f, 0x1731, 0x1733, 0x175b, // loc_1729: 0x3b/0x3c/0x3d all NZ -> jr nz taken -> loc_175b
  0x175c, 0x175e, 0x1763, // loc_175b: cp 0x26 NZ -> jr nz taken -> loc_1763
  0x1764, 0x1766, 0x1769, 0x176b, 0x176e, 0x1770, 0x1773, 0x1775, 0x1778, 0x177a, 0x177d, 0x177f, // loc_1763 solid cascade (all NZ)
  0x1782, 0x1784, 0x1786, 0x1788, 0x1798, // cp 0xc5 NZ, cp 0x96 -> jr c taken -> loc_1798
  0x179a, 0x179c, 0x179e, 0x17a0, // loc_1798: cp 0x71 (NC) / cp 0x9e (C) fall through
  0x17a1, 0x17a3, 0x17a5, 0x17a7, 0x17a9, 0x17ab, 0x17ad, 0x17ae, 0x17af, 0x17b1, 0x17b2, // sub/sla*3/rl/or ...
  0x17b3, 0x17b6, 0x17b7, 0x17b8, 0x17bb, 0x17bc, // hl / add / (hl) / store / cp e
  0x17be, 0x17bf, 0x17c1, // jr z NOT taken; ld a,d / and 7 / jr nz NOT taken (on grid)
  0x17c3, 0x17c6, 0x17c9, 0x17cb, 0x17ce, 0x17d0, 0x17d3, 0x1b5b, // arm 0x35 event -> tail
];
test("path C: on-grid tile 0x91 -> table mismatch (sla/rl carry into B) -> arm 0x35 -> tail", () => {
  const m = makeMachine({ 0x8100: 0x91, 0x80a3: 0x77 });
  m.regs.ix = 0x8100;
  m.regs.d = 0x00; // on grid
  loc_1704(m);
  assertPath(m, {
    steps: PATH_C_STEPS,
    calls: [0x1b5b],
    cycles:
      /* entry */ 7 + 13 + 19 + 13 + 13 + 4 + 4 + 7 + 7 + 4 + 7 + 12 + // 110
      /* 1729  */ 7 + 7 + 7 + 7 + 7 + 12 + // 47
      /* 175b  */ 4 + 7 + 12 + // 23
      /* 1763  */ 4 + 7 + 10 + 7 + 10 + 7 + 10 + 7 + 10 + 7 + 10 + 7 + 10 + 7 + 7 + 7 + 12 + // 149
      /* 1798a */ 7 + 7 + 7 + 7 + // 28  (cp 0x71 / jr c nt / cp 0x9e / jr nc nt)
      /* 1798b */ 4 + 7 + 7 + 8 + 8 + 8 + 8 + 4 + 4 + 7 + 4 + // 69  (ld e..or c)
      /* 1798c */ 4 + 10 + 11 + 7 + 13 + // 45  (ld c / hl / add / (hl) / store)
      /* 1798d */ 4 + 7 + 4 + 7 + 7 + // 29  (cp e / jr z nt / ld a,d / and 7 / jr nz nt)
      /* arm   */ 13 + 13 + 7 + 13 + 7 + 13 + 10, // 76  => 566 total
    pc: 0x1b5b,
    a: 0x35, // event id armed
    regs: { e: 0x91, b: 0x01, c: 0x00, hl: 0x1c78, d: 0x00 }, // (0x91-0x71)=0x20<<3 overflows bit8 -> B=1
    mem: {
      0x80a5: 0x91, // saved tile
      0x80a7: 0x00, // OVERWRITTEN by the table read (ROM zero)
      0x80a2: 0x02, // event param
      0x80a4: 0x77, // copied from 0x80a3
      0x8069: 0x35, // 0x35 event armed
      0x8076: 0x00, // tile != 0x26, not stashed
    },
  });
});

// --- Mutation: `ld a,0x70` (0x1753, the consumed-cell blank value) -> `ld a,0x60`.
//     Byte-identical to loc_1704 except that one immediate. Path B's control flow
//     and cycle total are UNCHANGED (ld a,n is 7T either way), so only the value
//     assertion on the blanked cell (mem[0x8200]) can reject it. --------------------
test("mutation: `ld a,0x60` for `ld a,0x70` at the cell blank is caught (cycles unchanged)", () => {
  function loc_1704_mutant(m) {
    const { regs, mem } = m;
    let next = 0x1704;
    for (;;) {
      switch (next) {
        case 0x1704: {
          regs.a = 0x00; m.step(0x1706, 7);
          mem.write8(0x80a8, regs.a); m.step(0x1709, 13);
          regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x170c, 19);
          mem.write8(0x80a5, regs.a); m.step(0x170f, 13);
          mem.write8(0x80a7, regs.a); m.step(0x1712, 13);
          regs.b = regs.a; m.step(0x1713, 4);
          regs.a = regs.d; m.step(0x1714, 4);
          regs.and(0x07); m.step(0x1716, 7);
          if (regs.fNZ) { m.step(0x175b, 12); next = 0x175b; break; }
          m.step(0x1718, 7);
          regs.a = regs.b; m.step(0x1719, 4);
          regs.cp(0x3a); m.step(0x171b, 7);
          if (regs.fNZ) { m.step(0x1729, 12); next = 0x1729; break; }
          m.step(0x171d, 7);
          m.push16(0x1720); m.step(0x467b, 17); m.call(0x467b);
          regs.a = mem.read8(0x8081); m.step(0x1723, 13);
          regs.a = regs.inc8(regs.a); m.step(0x1724, 4);
          mem.write8(0x8081, regs.a); m.step(0x1727, 13);
          m.step(0x174f, 12); next = 0x174f; break;
        }
        case 0x1729: {
          regs.cp(0x3b); m.step(0x172b, 7);
          if (regs.fZ) { m.step(0x1735, 12); next = 0x1735; break; }
          m.step(0x172d, 7);
          regs.cp(0x3c); m.step(0x172f, 7);
          if (regs.fZ) { m.step(0x1735, 12); next = 0x1735; break; }
          m.step(0x1731, 7);
          regs.cp(0x3d); m.step(0x1733, 7);
          if (regs.fNZ) { m.step(0x175b, 12); next = 0x175b; break; }
          m.step(0x1735, 7); next = 0x1735; break;
        }
        case 0x1735: {
          regs.a = mem.read8(0x8078); m.step(0x1738, 13);
          regs.or(regs.a); m.step(0x1739, 4);
          if (regs.fNZ) { m.step(0x1745, 12); next = 0x1745; break; }
          m.step(0x173b, 7);
          regs.a = mem.read8(0x80bd); m.step(0x173e, 13);
          regs.or(regs.a); m.step(0x173f, 4);
          if (regs.fNZ) { m.step(0x175b, 12); next = 0x175b; break; }
          m.step(0x1741, 7);
          regs.a = regs.inc8(regs.a); m.step(0x1742, 4);
          mem.write8(0x8078, regs.a); m.step(0x1745, 13);
          next = 0x1745; break;
        }
        case 0x1745: {
          m.push16(0x1748); m.step(0x4683, 17); m.call(0x4683);
          regs.a = mem.read8(0x8082); m.step(0x174b, 13);
          regs.a = regs.inc8(regs.a); m.step(0x174c, 4);
          mem.write8(0x8082, regs.a); m.step(0x174f, 13);
          next = 0x174f; break;
        }
        case 0x174f: {
          regs.ix = mem.read16(0x806e); m.step(0x1753, 20);
          regs.a = 0x60; m.step(0x1755, 7); // BUG: should be ld a,0x70
          mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x1758, 19);
          m.step(0x184a, 10); next = 0x184a; break;
        }
        case 0x175b: {
          regs.a = regs.b; m.step(0x175c, 4);
          regs.cp(0x26); m.step(0x175e, 7);
          if (regs.fNZ) { m.step(0x1763, 12); next = 0x1763; break; }
          m.step(0x1760, 7);
          mem.write8(0x8076, regs.a); m.step(0x1763, 13);
          next = 0x1763; break;
        }
        case 0x1763: {
          regs.a = regs.b; m.step(0x1764, 4);
          regs.cp(0x2a); m.step(0x1766, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1769, 10);
          regs.cp(0x41); m.step(0x176b, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x176e, 10);
          regs.cp(0xc1); m.step(0x1770, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1773, 10);
          regs.cp(0xc9); m.step(0x1775, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1778, 10);
          regs.cp(0x95); m.step(0x177a, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x177d, 10);
          regs.cp(0xc4); m.step(0x177f, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1782, 10);
          regs.cp(0xc5); m.step(0x1784, 7);
          if (regs.fZ) { m.step(0x1793, 12); next = 0x1793; break; }
          m.step(0x1786, 7);
          regs.cp(0x96); m.step(0x1788, 7);
          if (regs.fC) { m.step(0x1798, 12); next = 0x1798; break; }
          m.step(0x178a, 7);
          regs.cp(0x9a); m.step(0x178c, 7);
          if (regs.fC) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x178f, 10);
          regs.cp(0x9e); m.step(0x1791, 7);
          if (regs.fNC) { m.step(0x17d6, 12); next = 0x17d6; break; }
          m.step(0x1793, 7); next = 0x1793; break;
        }
        case 0x1793: {
          regs.bit(2, regs.d); m.step(0x1795, 8);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1798, 10); next = 0x1798; break;
        }
        case 0x1798: {
          regs.cp(0x71); m.step(0x179a, 7);
          if (regs.fC) { m.step(0x17d6, 12); next = 0x17d6; break; }
          m.step(0x179c, 7);
          regs.cp(0x9e); m.step(0x179e, 7);
          if (regs.fNC) { m.step(0x17d6, 12); next = 0x17d6; break; }
          m.step(0x17a0, 7);
          regs.e = regs.a; m.step(0x17a1, 4);
          regs.sub(0x71); m.step(0x17a3, 7);
          regs.b = 0x00; m.step(0x17a5, 7);
          regs.a = regs.sla(regs.a); m.step(0x17a7, 8);
          regs.a = regs.sla(regs.a); m.step(0x17a9, 8);
          regs.a = regs.sla(regs.a); m.step(0x17ab, 8);
          regs.b = regs.rl(regs.b); m.step(0x17ad, 8);
          regs.c = regs.a; m.step(0x17ae, 4);
          regs.a = regs.d; m.step(0x17af, 4);
          regs.and(0x07); m.step(0x17b1, 7);
          regs.or(regs.c); m.step(0x17b2, 4);
          regs.c = regs.a; m.step(0x17b3, 4);
          regs.hl = 0x1b78; m.step(0x17b6, 10);
          regs.addHl(regs.bc); m.step(0x17b7, 11);
          regs.a = mem.read8(regs.hl); m.step(0x17b8, 7);
          mem.write8(0x80a7, regs.a); m.step(0x17bb, 13);
          regs.cp(regs.e); m.step(0x17bc, 4);
          if (regs.fZ) { m.step(0x17d6, 12); next = 0x17d6; break; }
          m.step(0x17be, 7);
          regs.a = regs.d; m.step(0x17bf, 4);
          regs.and(0x07); m.step(0x17c1, 7);
          if (regs.fNZ) { m.step(0x17db, 12); next = 0x17db; break; }
          m.step(0x17c3, 7);
          regs.a = mem.read8(0x80a3); m.step(0x17c6, 13);
          mem.write8(0x80a4, regs.a); m.step(0x17c9, 13);
          regs.a = 0x02; m.step(0x17cb, 7);
          mem.write8(0x80a2, regs.a); m.step(0x17ce, 13);
          regs.a = 0x35; m.step(0x17d0, 7);
          mem.write8(0x8069, regs.a); m.step(0x17d3, 13);
          m.step(0x1b5b, 10); return m.call(0x1b5b);
        }
        case 0x17d6: {
          regs.a = regs.d; m.step(0x17d7, 4);
          regs.and(0x07); m.step(0x17d9, 7);
          if (regs.fZ) { m.step(0x184a, 12); next = 0x184a; break; }
          m.step(0x17db, 7); next = 0x17db; break;
        }
        case 0x17db: {
          regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x17de, 19);
          mem.write8(0x80a6, regs.a); m.step(0x17e1, 13);
          regs.cp(0x2a); m.step(0x17e3, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x17e6, 10);
          regs.cp(0x41); m.step(0x17e8, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x17eb, 10);
          regs.cp(0xc1); m.step(0x17ed, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x17f0, 10);
          regs.cp(0xc4); m.step(0x17f2, 7);
          if (regs.fZ) { m.step(0x1801, 12); next = 0x1801; break; }
          m.step(0x17f4, 7);
          regs.cp(0x95); m.step(0x17f6, 7);
          if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x17f9, 10);
          regs.cp(0x96); m.step(0x17fb, 7);
          if (regs.fC) { m.step(0x1807, 12); next = 0x1807; break; }
          m.step(0x17fd, 7);
          regs.cp(0x9a); m.step(0x17ff, 7);
          if (regs.fNC) { m.step(0x1840, 12); next = 0x1840; break; }
          m.step(0x1801, 7); next = 0x1801; break;
        }
        case 0x1801: {
          regs.d = regs.dec8(regs.d); m.step(0x1802, 4);
          regs.bit(2, regs.d); m.step(0x1804, 8);
          if (regs.fNZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); }
          m.step(0x1807, 10); next = 0x1807; break;
        }
        case 0x1807: {
          regs.cp(0x71); m.step(0x1809, 7);
          if (regs.fC) { m.step(0x1840, 12); next = 0x1840; break; }
          m.step(0x180b, 7);
          regs.cp(0x9e); m.step(0x180d, 7);
          if (regs.fNC) { m.step(0x1840, 12); next = 0x1840; break; }
          m.step(0x180f, 7);
          regs.e = regs.a; m.step(0x1810, 4);
          regs.sub(0x71); m.step(0x1812, 7);
          regs.b = 0x00; m.step(0x1814, 7);
          regs.a = regs.sla(regs.a); m.step(0x1816, 8);
          regs.a = regs.sla(regs.a); m.step(0x1818, 8);
          regs.a = regs.sla(regs.a); m.step(0x181a, 8);
          regs.b = regs.rl(regs.b); m.step(0x181c, 8);
          regs.c = regs.a; m.step(0x181d, 4);
          regs.a = regs.d; m.step(0x181e, 4);
          regs.and(0x07); m.step(0x1820, 7);
          regs.or(regs.c); m.step(0x1821, 4);
          regs.c = regs.a; m.step(0x1822, 4);
          regs.hl = 0x1ce0; m.step(0x1825, 10);
          regs.addHl(regs.bc); m.step(0x1826, 11);
          regs.a = mem.read8(regs.hl); m.step(0x1827, 7);
          mem.write8(0x80a8, regs.a); m.step(0x182a, 13);
          regs.cp(regs.e); m.step(0x182b, 4);
          if (regs.fZ) { m.step(0x1840, 12); next = 0x1840; break; }
          m.step(0x182d, 7); next = 0x182d; break;
        }
        case 0x182d: {
          regs.a = mem.read8(0x80a3); m.step(0x1830, 13);
          mem.write8(0x80a4, regs.a); m.step(0x1833, 13);
          regs.a = 0x02; m.step(0x1835, 7);
          mem.write8(0x80a2, regs.a); m.step(0x1838, 13);
          regs.a = 0x35; m.step(0x183a, 7);
          mem.write8(0x8069, regs.a); m.step(0x183d, 13);
          m.step(0x1b5b, 10); return m.call(0x1b5b);
        }
        case 0x1840: {
          regs.a = mem.read8(0x80a5); m.step(0x1843, 13);
          regs.e = regs.a; m.step(0x1844, 4);
          regs.a = mem.read8(0x80a7); m.step(0x1847, 13);
          regs.cp(regs.e); m.step(0x1848, 4);
          if (regs.fNZ) { m.step(0x182d, 12); next = 0x182d; break; }
          m.step(0x184a, 7); next = 0x184a; break;
        }
        case 0x184a: {
          regs.a = mem.read8(0x806c); m.step(0x184d, 13);
          regs.e = regs.a; m.step(0x184e, 4);
          regs.a = mem.read8(0x8068); m.step(0x1851, 13);
          regs.add(regs.e); m.step(0x1852, 4);
          mem.write8(0x8068, regs.a); m.step(0x1855, 13);
          regs.add(0x03); m.step(0x1857, 7);
          regs.and(0x07); m.step(0x1859, 7);
          mem.write8(0x8075, regs.a); m.step(0x185c, 13);
          regs.and(0x02); m.step(0x185e, 7);
          regs.a = 0x32; m.step(0x1860, 7);
          if (regs.fZ) { m.step(0x1864, 12); next = 0x1864; break; }
          m.step(0x1862, 7);
          regs.a = 0x33; m.step(0x1864, 7);
          next = 0x1864; break;
        }
        case 0x1864: {
          mem.write8(0x8069, regs.a); m.step(0x1867, 13);
          m.step(0x1b5b, 10); return m.call(0x1b5b);
        }
        default:
          throw new Error("mutant: bad block 0x" + next.toString(16));
      }
    }
  }

  const m = makeMachine({
    0x8100: 0x3a, 0x8081: 0x10, 0x806e: 0x00, 0x806f: 0x82, 0x806c: 0x01, 0x8068: 0x00,
  });
  m.regs.ix = 0x8100;
  m.regs.d = 0x00;
  loc_1704_mutant(m);
  // Cycles + control flow are identical to real Path B, so only the value check rejects it.
  assert.equal(m.cycles, 343, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.deepEqual(m.steps, PATH_B_STEPS, "mutation preserves the step sequence (control flow unchanged)");
  assert.equal(m.mem.read8(0x8200), 0x60, "mutant blanks the cell with 0x60, not 0x70");
  assert.throws(
    () =>
      assertPath(m, {
        steps: PATH_B_STEPS,
        calls: [0x467b, 0x1b5b],
        pushes: [0x1720],
        cycles: 343,
        pc: 0x1b5b,
        a: 0x32,
        regs: { ix: 0x8200 },
        mem: { 0x8200: 0x70 }, // the real value; the mutant wrote 0x60
      }),
    /mem\[0x8200\]/,
  );
});
