// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_4b14 (ROM 0x4b14-0x4b19): ENABLE the NMI by writing 0x01
// to the LS259 addressable latch at 0xb000 (bit 0 = NMI mask), then ret.
//
//   4b14  3e 01       ld   a,0x01           (7 T)
//   4b16  32 00 b0    ld   (0xb000),a       (13 T)  -> writeControlLatch(0, 1)
//   4b19  c9          ret                   (10 T)
//
// Asserts the 30 T-state total, A == 0x01 at exit, the bit-ADDRESSABLE latch
// effect (b0 set, other latch bits preserved) via m.io.nmiMask / m.io.latch,
// that no flags are touched, and the ret landing -- each against the
// disassembly. Ends with a MUTATION (`ld a,0x00`, the sibling sub_4b10 datum
// that CLEARS the mask) proven caught by both the effect and A assertions.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C, F_S } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_4b14 } from "../sub_4b14.js";

const RET = 0x1234; // sentinel return address pushed before the call

// Minimal machine: real Regs + real Pit AddressSpace + real Io (so the LS259
// latch effect of the 0xb000 write is observable), plus the step/ret seam.
// No m.call here (the routine has none).
function makeMachine({ latch = 0x00, f = 0x00 } = {}) {
  const io = new Io();
  io.latch = latch & 0xff; // seed other latch bits to prove bit-addressable OR-in
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)
  regs.f = f & 0xff; // seed flags to prove the routine touches none

  const m = {
    regs,
    mem,
    io,
    tstates: 0,
    pc: 0x4b14,
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
    },
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
    ret(cycles = 10) {
      this.pc = this.pop16();
      this.tstates += cycles;
      this.returned = true;
    },
    call(addr) {
      throw new Error(`unexpected m.call(0x${addr.toString(16).padStart(4, "0")})`);
    },
  };
  m.push16(RET); // the return address sub_4b14's `ret` must pop
  return m;
}

test("sets LS259 b0 (NMI mask), A=0x01, 30 T, returns", () => {
  const m = makeMachine();
  sub_4b14(m);

  assert.equal(m.regs.a, 0x01, "A holds the datum 0x01");
  assert.equal(m.io.latch, 0x01, "LS259 latch b0 set");
  assert.equal(m.io.nmiMask, true, "NMI enabled (b0 = 1)");
  assert.equal(m.returned, true, "ret executed");
  assert.equal(m.pc, RET, "ret popped the sentinel return address");
  // T: ld a,n 7 + ld (nn),a 13 + ret 10
  assert.equal(m.tstates, 7 + 13 + 10);
  assert.equal(m.tstates, 30);
});

test("the write is bit-ADDRESSABLE: b0 is OR-ed in, other latch bits preserved", () => {
  // Seed flip-Y (b7) + sound-enable (b3) already set; the 0xb000 write must set
  // b0 WITHOUT disturbing them (LS259 = one bit per address), i.e. 0x88 -> 0x89.
  const m = makeMachine({ latch: 0x88 });
  sub_4b14(m);

  assert.equal(m.io.latch, 0x89, "b0 set, b3 and b7 untouched (addressable latch)");
  assert.equal(m.io.nmiMask, true);
});

test("touches no flags (ld/ld/ret): F residue is the caller's", () => {
  const seedF = F_S | F_C; // an arbitrary non-trivial flag pattern
  const m = makeMachine({ f: seedF });
  sub_4b14(m);

  assert.equal(m.regs.f, seedF, "F unchanged by ld a,n / ld (nn),a / ret");
});

// ---- MUTATION: `ld a,0x00` (the sibling sub_4b10 datum) --------------------
// sub_4b10 loads 0x00 and falls into the SAME loc_4b16 tail to CLEAR the mask
// (DISABLE the NMI). Confusing the two entry points is the real hazard: the
// mutant writes 0x00, leaving b0 = 0 (nmiMask false) and A = 0x00. The correct
// routine SETS the mask; so the effect (latch/nmiMask) and A assertions must
// both reject the mutant. T-states are identical (30), so timing alone can't
// catch it -- the effect assertion is load-bearing.
function sub_4b14_mut(m) {
  const { regs, mem } = m;
  regs.a = 0x00; // BUG: 0x00 (sub_4b10) instead of 0x01 -- CLEARS the mask
  m.step(0x4b16, 7);
  mem.write8(0xb000, regs.a, 10);
  m.step(0x4b19, 13);
  m.ret();
}

function assertEnablesNmi(fn) {
  const m = makeMachine();
  fn(m);
  assert.equal(m.io.nmiMask, true, "must ENABLE the NMI (LS259 b0 = 1)");
  assert.equal(m.regs.a, 0x01, "must load the datum 0x01");
}

test("the assertions have teeth: the ld-a-0x00 mutation is caught", () => {
  assertEnablesNmi(sub_4b14); // the real routine passes it
  assert.throws(() => assertEnablesNmi(sub_4b14_mut), /ENABLE the NMI|datum 0x01/);
});
