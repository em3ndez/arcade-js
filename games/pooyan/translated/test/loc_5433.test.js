// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5433 (ROM 0x5433, Pooyan) -- enemy object-block initializer at IX.
 * Bails via `ret nz` when the block is already live ((ix+0)|(ix+1) != 0); otherwise seeds the block,
 * runs two rst-0x20 table lookups (loc_0020) and two loc_0c45 word lookups, an animation tick
 * (loc_4006), and bumps the level index at 0x8d01.
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), then
 * models each callee's net effect that loc_5433 observes:
 *   0x0020 (loc_0020): A <- mem[(HL + A) & 0xffff]  -- the rst-0x20 table byte.
 *   0x0c45 (loc_0c45): DE <- LE word at (HL + 2*A); C preserved.
 *   0x4006 (loc_4006): animation tick -- preserves C and every register loc_5433 reads afterward.
 * Because the mock pops, a call site that forgot its push16 desyncs the stack (the final ret misses
 * CALLER_RET) -- so the SP-baseline assertion has real teeth.
 *
 * Path FULL (block free): full pcSeq (visiting the call TARGETS 0x0020/0x0c45/0x4006), T=459, all
 * block writes, 0x8d01 bumped C+1. Path BUSY (block live): `ret nz` after 2 reads, T=49.
 * TEETH: mis-charge `ld a,(ix+0)` as 7 T (a non-IX ld) -> the 459-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_5433.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5433 } from "../loc_5433.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5433, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address loc_5433 pushed at the call site -- model that pop so
    // the stack stays balanced (a missing push16 then desyncs SP and fails the test). Then model the
    // callee's net effect on the state loc_5433 reads back.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) {
        regs.a = mem.read8((regs.hl + regs.a) & 0xffff); // loc_0020: A = mem[HL + A]
      } else if (addr === 0x0c45) {
        const p = (regs.hl + 2 * (regs.a & 0xff)) & 0xffff; // loc_0c45: DE = word[HL + 2*A]
        regs.de = mem.read8(p) | (mem.read8((p + 1) & 0xffff) << 8);
      }
      // 0x4006: preserves C and all registers loc_5433 uses afterward.
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PC_FULL = [
  0x5436, 0x5439, 0x543a, 0x543e, 0x543f, 0x5442, 0x5445, 0x5449, 0x544d, 0x5450, 0x5453, 0x5456, 0x5457,
  0x0020,                         // rst 0x20 #1 -> target
  0x545b, 0x545e, 0x545f,
  0x0020,                         // rst 0x20 #2 -> target
  0x5462, 0x5465, 0x5468, 0x5469,
  0x0c45,                         // call 0x0c45 #1 -> target
  0x546d, 0x5470, 0x5473,
  0x0c45,                         // call 0x0c45 #2 -> target
  0x5479, 0x547c, 0x5480,
  0x4006,                         // call 0x4006 -> target
  0x5484, 0x5485, 0x5488,
  CALLER_RET,
];

function setupFull(m) {
  seatCaller(m);
  m.regs.ix = 0x8c30;
  // block free: (ix+0)|(ix+1) == 0 -> `ret nz` not taken
  m.mem.write8(0x8c30, 0x00);
  m.mem.write8(0x8c31, 0x00);
  // level index at 0x8d01
  m.mem.write8(0x8d01, 0x02);
  // rst-0x20 table 0x55d4[C=2] = 0x55d6 -> (ix+6)
  m.mem.write8(0x55d6, 0x37);
  // rst-0x20 table 0x55d7[C=2] = 0x55d9 -> neg -> (ix+0a)
  m.mem.write8(0x55d9, 0x05);
  // word table 0x561f[2*C=4] = 0x5623 -> DE=0x9000; mem[0x9000] -> (ix+17)
  m.mem.write8(0x5623, 0x00);
  m.mem.write8(0x5624, 0x90);
  m.mem.write8(0x9000, 0x42);
  // word table 0x5657[2*0x42=0x84] = 0x56db -> DE=0x1234 -> (ix+0c/0d)
  m.mem.write8(0x56db, 0x34);
  m.mem.write8(0x56dc, 0x12);
}

test("loc_5433 Path FULL: free block -> seed + two lookups + tick + bump level", () => {
  const m = makeMachine();
  setupFull(m);

  loc_5433(m);

  assert.equal(m.tstates, 459, "Path FULL T-state total");
  assert.deepEqual(m.pcSeq, PC_FULL, "step boundaries match the ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret at 0x5488 to the seated caller");
  assert.deepEqual(m.calls, [0x0020, 0x0020, 0x0c45, 0x0c45, 0x4006], "callee sequence");
  // seeded block bytes
  assert.equal(m.mem.read8(0x8c30), 0x01, "(ix+0) active flag");
  assert.equal(m.mem.read8(0x8c32), 0x00, "(ix+2) zeroed");
  assert.equal(m.mem.read8(0x8c33), 0x60, "(ix+3) = 0x60");
  assert.equal(m.mem.read8(0x8c34), 0x1b, "(ix+4) = 0x1b");
  assert.equal(m.mem.read8(0x8c35), 0x00, "(ix+5) zeroed");
  assert.equal(m.mem.read8(0x8c3e), 0x00, "(ix+0e) zeroed");
  assert.equal(m.mem.read8(0x8c41), 0x40, "(ix+11) frame-hold = 0x40");
  // table-driven bytes
  assert.equal(m.mem.read8(0x8c36), 0x37, "(ix+6) from rst-0x20 table 0x55d4");
  assert.equal(m.mem.read8(0x8c3a), 0xfb, "(ix+0a) = -(table 0x55d7 byte 0x05)");
  assert.equal(m.mem.read8(0x8c47), 0x42, "(ix+17) = mem[DE] from first 0x0c45 lookup");
  assert.equal(m.mem.read8(0x8c3c), 0x34, "(ix+0c) = E from second 0x0c45 lookup");
  assert.equal(m.mem.read8(0x8c3d), 0x12, "(ix+0d) = D from second 0x0c45 lookup");
  // level index bumped and stored back (C preserved across all callees)
  assert.equal(m.regs.c, 0x02, "C (level index) preserved");
  assert.equal(m.mem.read8(0x8d01), 0x03, "0x8d01 = C + 1");
  // stack fully unwound: every push16 matched a callee pop, final ret consumed CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_5433 Path BUSY: live block -> ret nz after two reads", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8c30;
  m.mem.write8(0x8c30, 0x00);
  m.mem.write8(0x8c31, 0x01); // (ix+0)|(ix+1) != 0 -> ret nz taken

  loc_5433(m);

  assert.equal(m.tstates, 19 + 19 + 11, "ld a,(ix+0) + or (ix+1) + ret nz taken");
  assert.deepEqual(m.pcSeq, [0x5436, 0x5439, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nz to the seated caller");
  assert.deepEqual(m.calls, [], "no seeding when the block is already live");
  assert.equal(m.mem.read8(0x8c30), 0x00, "block untouched (active flag not written)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound (ret nz popped CALLER_RET)");
});

test("loc_5433 MUTATION: `ld a,(ix+0)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5436 ? 7 : cycles);
  setupFull(m);

  loc_5433(m);

  assert.equal(m.tstates, 447, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 459, "Path FULL T-state total"),
    /459/,
    "the 459-T golden must fail on the mutant",
  );
});
