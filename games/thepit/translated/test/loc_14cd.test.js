// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_14cd (ROM 0x14cd-0x1657): the object-vs-tilemap
// collision/dispatch body entered from loc_1493. It derives a video-RAM cell
// address from the column byte 0x806b and the object row in H, then classifies
// the tile under (and ahead of) the object and either latches state + tail-jumps
// to the shared tail 0x1659, stamps the cell and hands off, or defers the frame
// via 0x1b5b.
//
// The three golden paths below were computed INDEPENDENTLY from the disassembly
// (games/thepit/out/dk.asm) by a per-opcode length+T-state walker, NOT from the
// translation under test, so matching them proves the translation charges the
// ROM's exact cycles and lands every m.step on a real instruction boundary:
//
//   A marker_aligned : tile under object == 0x27 and object grid-aligned ->
//                      latch 0x80e7/0x8077 = 1, jp 0x1659.              311 T
//   B tile_3a_call   : tile under object == 0x3a, aligned -> call 0x467b,
//                      bump 0x8081, stamp the cell with 0x70, jp 0x1659. 442 T
//   C solid_defer    : not aligned, tile 0x2a is "solid" -> the loc_1578
//                      classification ladder defers via jp z 0x1b5b.     377 T
//
// The mutation re-runs path C's `jr nz 0x1568` with a corrupted 0x1569 target;
// a taken jr is 12 T either way, so the cycle total is UNCHANGED and it is the
// step-target assertion (not the cycle count) that must reject it.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_14cd, loc_14cd_1515, loc_14cd_1568 } from "../loc_14cd.js";

// Leaf-routine machine double: exactly the surface loc_14cd touches. step records
// its target + charges cycles; call records a tail-jump/returning-call target
// WITHOUT running the real callee (0x467b/0x4683/0x1659/0x1b5b are separate
// units); push16 records the pushed return address. A real AddressSpace backs
// mem so the (ix) video-RAM writes and the 0x806e word round-trip faithfully.
function makeMachine(seed = {}, regH = 0) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; loc_14cd reads no ROM on these paths
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x14cd,
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
      return undefined; // callee's own ret returns to OUR caller
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.regs.sp = 0x8780; // inside work RAM, so push16 lands somewhere real
  m.push16 = (v) => {
    m.regs.sp = (m.regs.sp - 2) & 0xffff;
    m.mem.write8(m.regs.sp, v & 0xff);
    m.mem.write8((m.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    m.pushes.push(v & 0xffff);
  };
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  m.regs.h = regH;
  return m;
}

// --- Golden step targets, copied verbatim from the disassembly-driven walker ---

const A_STEPS = [
  0x14d0, 0x14d2, 0x14d3, 0x14d5, 0x14d7, 0x14d9, 0x14dc, 0x14dd, 0x14df, 0x14e0,
  0x14e2, 0x14e3, 0x14e5, 0x14e6, 0x14e8, 0x14e9, 0x14ea, 0x14eb, 0x14ee, 0x14ef,
  0x14f2, 0x14f6, 0x14f8, 0x14fb, 0x14fe, 0x1500, 0x1502, 0x1505, 0x1507, 0x1509,
  0x150b, 0x150c, 0x150f, 0x1512, 0x1659,
];

const B_STEPS = [
  0x14d0, 0x14d2, 0x14d3, 0x14d5, 0x14d7, 0x14d9, 0x14dc, 0x14dd, 0x14df, 0x14e0,
  0x14e2, 0x14e3, 0x14e5, 0x14e6, 0x14e8, 0x14e9, 0x14ea, 0x14eb, 0x14ee, 0x14ef,
  0x14f2, 0x14f6, 0x14f8, 0x14fb, 0x14fe, 0x1500, 0x1515, 0x1518, 0x151b, 0x151e,
  0x151f, 0x1520, 0x1522, 0x1524, 0x1525, 0x1527, 0x1529, 0x467b, 0x152f, 0x1530,
  0x1533, 0x155c, 0x1560, 0x1562, 0x1565, 0x1659,
];

const C_STEPS = [
  0x14d0, 0x14d2, 0x14d3, 0x14d5, 0x14d7, 0x14d9, 0x14dc, 0x14dd, 0x14df, 0x14e0,
  0x14e2, 0x14e3, 0x14e5, 0x14e6, 0x14e8, 0x14e9, 0x14ea, 0x14eb, 0x14ee, 0x14ef,
  0x14f2, 0x14f6, 0x14f8, 0x14fb, 0x14fe, 0x1500, 0x1515, 0x1518, 0x151b, 0x151e,
  0x151f, 0x1520, 0x1522, 0x1568, 0x1569, 0x156b, 0x1570, 0x1571, 0x1573, 0x1578,
  0x157a, 0x1b5b,
];

test("path A: 0x27 marker, aligned -> latch + jp 0x1659", () => {
  // mem[0x806b]=0 -> D=5, column=0. H=0 -> cell = 0x9000, IX=0x9000.
  // (ix+1)=mem[0x9001]=0x27, mem[0x8068]=5 -> (5+3)&7==0 (grid-aligned).
  const m = makeMachine({ 0x806b: 0x00, 0x8068: 0x05, 0x9001: 0x27 }, 0x00);
  loc_14cd(m);

  assert.deepEqual(m.steps, A_STEPS, "step targets");
  assert.equal(m.cycles, 311, "T-state total");
  assert.deepEqual(m.calls, [0x1659], "tail-jump to 0x1659");
  assert.deepEqual(m.pushes, [], "no ordinary calls on this path");
  assert.equal(m.returned, false, "no early ret (tail-jump)");
  assert.equal(m.pc, 0x1659, "final PC");
  assert.equal(m.regs.a, 0x01, "A latched to 1");
  assert.equal(m.mem.read8(0x80e7), 0x01, "0x80e7 latched");
  assert.equal(m.mem.read8(0x8077), 0x01, "0x8077 latched");
  assert.equal(m.mem.read8(0x8071), 0x00, "column stored");
  assert.equal(m.mem.read16(0x806e), 0x9000, "cell pointer");
  assert.equal(m.mem.read8(0x80a8), 0x00, "tile-ahead scratch cleared");
});

test("path B: tile 0x3a, aligned -> call 0x467b + stamp 0x70 + jp 0x1659", () => {
  // mem[0x806b]=3 -> D=8, column=1. H=0 -> cell = 0x9001, IX=0x9001.
  // (ix+0)=mem[0x9001]=0x3a, (ix+1)=mem[0x9002]=0 (!=0x27).
  const m = makeMachine({ 0x806b: 0x03, 0x9001: 0x3a, 0x9002: 0x00, 0x8081: 0x00 }, 0x00);
  loc_14cd(m);

  assert.deepEqual(m.steps, B_STEPS, "step targets");
  assert.equal(m.cycles, 442, "T-state total");
  assert.deepEqual(m.calls, [0x467b, 0x1659], "ordinary call then tail-jump");
  assert.deepEqual(m.pushes, [0x152c], "call 0x467b pushed its return address");
  assert.equal(m.returned, false, "no early ret");
  assert.equal(m.pc, 0x1659, "final PC");
  assert.equal(m.regs.a, 0x70, "A = the stamp value");
  assert.equal(m.mem.read8(0x80a5), 0x3a, "tile recorded to 0x80a5");
  assert.equal(m.mem.read8(0x80a7), 0x3a, "tile recorded to 0x80a7");
  assert.equal(m.mem.read8(0x8081), 0x01, "0x8081 counter bumped");
  assert.equal(m.mem.read8(0x9001), 0x70, "cell stamped with 0x70");
});

test("path C: not aligned, solid tile 0x2a -> ladder defers via jp z 0x1b5b", () => {
  // mem[0x806b]=0 -> D=5, D&7==5 (not aligned). H=0 -> cell = 0x9000.
  // (ix+0)=mem[0x9000]=0x2a (solid), (ix+1)=mem[0x9001]=0 (!=0x27).
  const m = makeMachine({ 0x806b: 0x00, 0x9000: 0x2a, 0x9001: 0x00 }, 0x00);
  loc_14cd(m);

  assert.deepEqual(m.steps, C_STEPS, "step targets");
  assert.equal(m.cycles, 377, "T-state total");
  assert.deepEqual(m.calls, [0x1b5b], "deferred to 0x1b5b");
  assert.deepEqual(m.pushes, [], "no ordinary calls on this path");
  assert.equal(m.returned, false, "no early ret");
  assert.equal(m.pc, 0x1b5b, "final PC");
  assert.equal(m.regs.a, 0x2a, "A = the classified tile id");
  assert.equal(m.regs.fZ, true, "cp 0x2a set Z (the branch that deferred)");
  assert.equal(m.mem.read8(0x80a5), 0x2a, "tile recorded to 0x80a5");
  assert.equal(m.mem.read8(0x80a7), 0x2a, "tile recorded to 0x80a7");
});

// A crafted post-block-A entry state for the helper unit tests: IX points at a
// cell whose (ix+0) tile is 0x2a, D&7 != 0 (not aligned). Driving loc_14cd_1515
// directly reproduces path C from the loc_1515 label onward.
function enter1515() {
  const m = makeMachine({ 0x9000: 0x2a, 0x9001: 0x00, 0x806e: 0x00 }, 0x00);
  m.mem.write16(0x806e, 0x9000);
  m.regs.ix = 0x9000;
  m.regs.d = 0x05; // D & 7 == 5 -> not aligned
  m.steps.length = 0;
  m.cycles = 0;
  m.pc = 0x1515;
  return m;
}

test("loc_14cd_1515 (real) steps into loc_1568 at 0x1568", () => {
  const m = enter1515();
  loc_14cd_1515(m);
  // aligned test fails (D&7 != 0) so `jr nz 0x1568` is TAKEN to the real 0x1568.
  assert.deepEqual(m.steps.slice(0, 7), [0x1518, 0x151b, 0x151e, 0x151f, 0x1520, 0x1522, 0x1568], "real routing");
  assert.deepEqual(m.calls, [0x1b5b], "solid 0x2a still defers");
});

test("mutation: a corrupted jr-nz target (0x1568 -> 0x1569) is caught", () => {
  // Byte-identical to loc_14cd_1515 up through the `jr nz 0x1568`, except the
  // taken target is 0x1569. A taken jr is 12 T either way, so the cycle total is
  // UNCHANGED; it is the step-target assertion that must reject it.
  function loc_14cd_1515_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(regs.ix);
    m.step(0x1518, 19);
    mem.write8(0x80a5, regs.a);
    m.step(0x151b, 13);
    mem.write8(0x80a7, regs.a);
    m.step(0x151e, 13);
    regs.b = regs.a;
    m.step(0x151f, 4);
    regs.a = regs.d;
    m.step(0x1520, 4);
    regs.and(0x07);
    m.step(0x1522, 7);
    if (regs.fNZ) {
      m.step(0x1569, 12); // BUG: should be 0x1568
      return loc_14cd_1568(m);
    }
    m.step(0x1524, 7);
  }

  const real = enter1515();
  loc_14cd_1515(real);
  const mutant = enter1515();
  loc_14cd_1515_mutant(mutant);

  // Same cycle total (the jr is taken and costs 12 T regardless of target)...
  assert.equal(mutant.cycles, real.cycles, "mutation preserves the cycle total");
  // ...but the step sequence differs at the corrupted target, so a full-path
  // comparison against the real routine's steps must throw.
  assert.throws(
    () => assert.deepEqual(mutant.steps, real.steps, "step targets"),
    /step targets/,
    "the step-target assertion catches the corrupted jr target",
  );
});
