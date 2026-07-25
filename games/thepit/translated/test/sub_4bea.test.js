// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_4bea (ROM 0x4BEA-0x4BFE). Asserts the T-state total and
// the routine's key register/flag/memory/control-flow effects against the
// disassembly, plus a deliberate mutation the invariant checker must catch.
//
// sub_4bea has a single control-flow path (two unconditional djnz fill loops),
// so there is one behaviour to pin: it zeroes 0x8031..0x8036 (6 bytes) then
// 0x801E..0x8027 (10 bytes), touches NO flags, ends B=0 / HL=0x8028, and rets.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_4bea } from "../sub_4bea.js";

// Minimal, faithful stand-in for the machine (identical to sub_23e8.test.js):
// real Regs, real AddressSpace/Io, step/call/ret/push16 modelled as the DK
// machine does. sub_4bea makes no calls, so `calls` should stay empty.
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM (unused here -- no push)
    this.cycles = 0;
    this.pc = 0x4bea;
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
  }
  call(addr) {
    this.calls.push(addr);
    return undefined;
  }
  ret(cycles = 10) {
    this.cycles += cycles;
    this.returned = true;
  }
  push16(value) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, value & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }
}

const FIRST_BLOCK = [0x8031, 0x8032, 0x8033, 0x8034, 0x8035, 0x8036]; // 6 bytes
const SECOND_BLOCK = [0x801e, 0x801f, 0x8020, 0x8021, 0x8022, 0x8023, 0x8024, 0x8025, 0x8026, 0x8027]; // 10 bytes
// Cells just outside each block -- must be left untouched (boundary teeth).
const UNTOUCHED = [0x8030, 0x8037, 0x801d, 0x8028];
const SENTINEL_F = 0xd7; // arbitrary caller flags; the routine must preserve them

// Pre-seed every target and boundary cell to 0xFF so a "did it get cleared"
// check is meaningful, and stamp a sentinel into F to prove F is preserved.
function setup(m) {
  for (const a of [...FIRST_BLOCK, ...SECOND_BLOCK, ...UNTOUCHED]) m.mem.write8(a, 0xff);
  m.regs.f = SENTINEL_F;
}

// Cycle budget, derived from the disassembly:
//   loop 1 (B=6):  ld b,n 7 + ld hl,nn 10 + 6*(ld(hl),n 10 + inc hl 6)
//                  + djnz 5*13 + 1*8  = 7 + 10 + 96 + 73 = 186
//   loop 2 (B=10): 7 + 10 + 10*16 + (9*13 + 8) = 7 + 10 + 160 + 125 = 302
//   ret 10
//   total = 186 + 302 + 10 = 498
const TOTAL_T = 498;

// The invariants that define correct behaviour. Shared by the real-routine test
// and the mutation test so the mutation is caught by exactly the checks that
// pass for the real routine.
function checkAll(m) {
  assert.equal(m.cycles, TOTAL_T, "T-state total (two full djnz loops + ret)");
  for (const a of FIRST_BLOCK) assert.equal(m.mem.read8(a), 0x00, `0x${a.toString(16)} cleared`);
  for (const a of SECOND_BLOCK) assert.equal(m.mem.read8(a), 0x00, `0x${a.toString(16)} cleared`);
  for (const a of UNTOUCHED) assert.equal(m.mem.read8(a), 0xff, `0x${a.toString(16)} untouched`);
  assert.equal(m.regs.b, 0x00, "B drained to 0 by djnz");
  assert.equal(m.regs.hl, 0x8028, "HL = 0x801E + 10 (one past the last cleared cell)");
  assert.equal(m.regs.f, SENTINEL_F, "F preserved -- routine touches no flags");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.returned, true, "routine returned via ret");
}

test("sub_4bea clears both blocks, preserves flags, and returns", () => {
  const m = new MockMachine();
  setup(m);
  sub_4bea(m);
  checkAll(m);
});

// ---- MUTATION --------------------------------------------------------------
// A faithful copy with ONE deliberate break: the FIRST loop's `ld (hl),0x00`
// writes 0x01 instead of 0x00. The 6-byte block ends up filled with 0x01, which
// checkAll's "cleared" invariant must reject. (Note the cycle total is
// UNCHANGED -- ld (hl),n is 10 T either way -- so this proves the MEMORY
// invariant, not the cycle count, has teeth.)
function sub_4bea_MUTANT(m) {
  const { regs, mem } = m;

  regs.b = 0x06;
  m.step(0x4bec, 7);
  regs.hl = 0x8031;
  m.step(0x4bef, 10);
  for (;;) {
    mem.write8(regs.hl, 0x01); // <-- MUTATION: 0x01 instead of 0x00
    m.step(0x4bf1, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4bf2, 6);
    if (regs.djnz() !== 0) {
      m.step(0x4bef, 13);
    } else {
      m.step(0x4bf4, 8);
      break;
    }
  }

  regs.b = 0x0a;
  m.step(0x4bf6, 7);
  regs.hl = 0x801e;
  m.step(0x4bf9, 10);
  for (;;) {
    mem.write8(regs.hl, 0x00);
    m.step(0x4bfb, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4bfc, 6);
    if (regs.djnz() !== 0) {
      m.step(0x4bf9, 13);
    } else {
      m.step(0x4bfe, 8);
      break;
    }
  }
  m.ret();
}

test("MUTATION caught: first loop filling 0x01 instead of 0x00 leaves the block dirty", () => {
  const good = new MockMachine();
  setup(good);
  sub_4bea(good);
  checkAll(good); // sanity: the real routine passes

  const bad = new MockMachine();
  setup(bad);
  sub_4bea_MUTANT(bad);
  assert.equal(bad.mem.read8(0x8031), 0x01, "mutant fills the first block with 0x01");
  assert.equal(bad.cycles, TOTAL_T, "mutant's cycle total is unchanged -- memory check is what catches it");
  assert.throws(() => checkAll(bad), "the invariant checker must reject the mutant");
});
