// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_492a (ROM 0x492A-0x4945): the 32-tile video-RAM column
// painter that copies ROM 0x49C7..0x49E6 into video RAM at 0x93F9 stride -0x20,
// then tail-jumps to loc_3e1d (colour-RAM column fill) with A=0x19, C=0x02.
//
// There is no built Pit Machine yet, so this drives the routine against a minimal
// mock of the Machine surface it touches: a real Regs (so addHl's H/N/C flags are
// genuine), a real Pit AddressSpace (so ROM reads and video-RAM writes hit the true
// memory map), a `step` that accumulates T-states + records the PC boundary
// sequence, and a `call` that captures the tail dispatch (target + machine state at
// the jump) and returns a sentinel standing in for loc_3e1d's return-through.
//
// It pins, against the disassembly:
//   - all 32 tile writes: source ROM byte -> dest video-RAM address (proves the
//     0x93F9 base, the -0x20 stride, AND the fixed 32-tile count),
//   - NO 33rd write at 0x8FF9 (the loop stops at 32),
//   - the exact local T-state total (1980) charged up to and including the jp,
//   - every m.step target lands on a real instruction boundary (stepcheck),
//   - exit registers: HL=0x8FF9, IX=0x49E7, B=0, and the args into the tail
//     A=0x19 / C=0x02, plus carry set from the final add hl,de,
//   - the tail-jump targets 0x3e1d and its result is returned straight through.
//
// TEETH: a twin that DROPS the loop `add hl,de` stride advance (so every tile lands
// on the same address and 32*11 T vanish) MUST be caught by the same contract check.
//
// Run: node --test games/thepit/translated/test/loc_492a.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_492a } from "../loc_492a.js";

const TAIL = 0x3e1d;
const SENTINEL = "RET_FROM_3e1d"; // stands in for loc_3e1d's return-through

const SRC = 0x49c7; // ROM source base
const DST = 0x93f9; // video-RAM dest base (first tile written)
const STRIDE = 0x20; // magnitude; DE = 0xffe0 = -0x20
const COUNT = 0x20; // B = 32 tiles
const HL_END = (DST - COUNT * STRIDE) & 0xffff; // 0x8ff9 -- one stride past the last write
const IX_END = SRC + COUNT; // 0x49e7
const src = (k) => (0x30 + k) & 0xff; // distinctive per-tile source pattern

function makeMachine() {
  const io = new Io();
  const rom = new Uint8Array(0x5000);
  // A distinctive source byte per tile pins BOTH the source address it came from
  // and the dest address it landed at in one assertion.
  for (let k = 0; k < COUNT; k++) rom[SRC + k] = src(k);
  const mem = new AddressSpace(rom, io);
  const regs = new Regs();

  return {
    regs,
    mem,
    tstates: 0,
    pc: 0x492a,
    pcSeq: [], // every step target, in order
    tail: null, // captured tail dispatch
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
      this.pcSeq.push(addr);
    },
    call(addr) {
      // Tail-jump modelled as `return m.call(target)`: capture machine state at the
      // instant control leaves loc_492a and hand back a sentinel.
      this.tail = {
        addr,
        cyclesAtJump: this.tstates,
        aAtJump: regs.a & 0xff,
        cAtJump: regs.c & 0xff,
        bAtJump: regs.b & 0xff,
        hlAtJump: regs.hl,
        ixAtJump: regs.ix,
        carryAtJump: regs.fC,
      };
      return SENTINEL;
    },
  };
}

function run(fn) {
  const m = makeMachine();
  const ret = fn(m);
  return { m, ret };
}

// Instruction-boundary sequence straight off the disassembly.
const EXPECTED_PC_SEQ = [0x492e, 0x4931, 0x4934, 0x4936];
for (let i = 0; i < COUNT; i++) {
  EXPECTED_PC_SEQ.push(0x4939, 0x493a, 0x493b, 0x493d);
  EXPECTED_PC_SEQ.push(i < COUNT - 1 ? 0x4936 : 0x493f); // djnz taken 31x, falls through once
}
EXPECTED_PC_SEQ.push(0x4941, 0x4943, 0x3e1d);

// The routine's full observable contract, shared by the real run and the mutant so
// the mutation is measured against exactly the assertions the routine must pass.
function checkContract(m, ret) {
  // 1. all 32 tile writes: source ROM byte -> dest video-RAM address.
  for (let k = 0; k < COUNT; k++) {
    const dst = (DST - k * STRIDE) & 0xffff;
    assert.equal(
      m.mem.read8(dst),
      src(k),
      `tile ${k}: ROM 0x${(SRC + k).toString(16)} -> VRAM 0x${dst.toString(16)}`,
    );
  }
  // 2. NO 33rd write -- the loop count is fixed at 32.
  assert.equal(m.mem.read8(HL_END), 0x00, "no 33rd tile written (count fixed at 32)");

  // 3. control flow: tail-jump to loc_3e1d, result returned through.
  assert.ok(m.tail, "must have tail-jumped (called a target)");
  assert.equal(m.tail.addr, TAIL, "tail-jump target must be 0x3e1d");
  assert.equal(ret, SENTINEL, "loc_492a must return the tail target's result");

  // 4. local T-state total up to and including the jp.
  assert.equal(m.tail.cyclesAtJump, 1980, "local T-state total must be 1980");

  // 5. exit registers + the tail-jump arguments.
  assert.equal(m.tail.hlAtJump, HL_END, "HL walked to 0x8ff9 (one stride past the last write)");
  assert.equal(m.tail.ixAtJump, IX_END, "IX advanced to 0x49e7 (32 source bytes)");
  assert.equal(m.tail.bAtJump, 0x00, "B counted down to 0");
  assert.equal(m.tail.aAtJump, 0x19, "A into the jp = 0x19 (ld a,0x19 -- loc_3e1d column)");
  assert.equal(m.tail.cAtJump, 0x02, "C into the jp = 0x02 (ld c,0x02 -- loc_3e1d colour)");
  assert.equal(m.tail.carryAtJump, true, "carry set from the final add hl,de (0x9019+0xffe0)");
}

test("loc_492a: 32-tile column copy, T-states, boundaries, exit regs, tail-jump", () => {
  const { m, ret } = run(loc_492a);
  checkContract(m, ret);
  // stepcheck: every step target is a real instruction boundary, in order.
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "m.step targets must match the disassembly boundaries");
  console.log(`  loc_492a: 1980 T, 32 tiles 0x${SRC.toString(16)}->VRAM stride -0x20, jp -> 0x${TAIL.toString(16)}`);
});

// -- TEETH --------------------------------------------------------------------
// Faithful copy of loc_492a EXCEPT the loop `add hl,de` (and its 11 T) is dropped,
// so every tile lands on the same address (0x93f9), tiles 1..31 stay 0, HL never
// advances, and the total loses 32*11 = 352 T. The memory teeth (tile 1 must land at
// 0x93d9), the T-state teeth (1980), and the HL exit check all reject it.
function brokenSub492a(m) {
  const { regs, mem } = m;
  regs.ix = 0x49c7;
  m.step(0x492e, 14);
  regs.hl = 0x93f9;
  m.step(0x4931, 10);
  regs.de = 0xffe0;
  m.step(0x4934, 10);
  regs.b = 0x20;
  m.step(0x4936, 7);
  do {
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x4939, 19);
    mem.write8(regs.hl, regs.a);
    m.step(0x493a, 7);
    // BUG: `add hl,de` (regs.addHl) and its 11 T-states omitted -> HL never advances.
    regs.ix = (regs.ix + 1) & 0xffff;
    m.step(0x493d, 10);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4936 : 0x493f, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  regs.c = 0x02;
  m.step(0x4941, 7);
  regs.a = 0x19;
  m.step(0x4943, 7);
  m.step(0x3e1d, 10);
  return m.call(0x3e1d);
}

test("TEETH: the dropped-stride twin is CAUGHT by the contract check", () => {
  const { m, ret } = run(brokenSub492a);
  assert.throws(
    () => checkContract(m, ret),
    /VRAM 0x|0x8ff9|1980/,
    "the contract check FAILED to catch a dropped add hl,de -- it has no teeth",
  );
  // and concretely: the broken twin left tile 1's dest empty and HL un-advanced.
  assert.equal(m.mem.read8((DST - STRIDE) & 0xffff), 0x00, "broken twin: tile 1 dest 0x93d9 stays 0");
  assert.equal(m.tail.hlAtJump, DST, "broken twin: HL never left 0x93f9");
});
