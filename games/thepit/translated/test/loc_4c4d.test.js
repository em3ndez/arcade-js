// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4c4d (ROM 0x4c4d-0x4c52, The Pit): the
// SET half of the sound-enable pair. It loads A=0x01 and stores it to the LS259
// control latch at 0xB003 (latch bit 3 = sound enable), then returns.
//
// Uses the REAL AddressSpace + Io so the 0xB003 store drives the ACTUAL LS259
// latch (proving bit 3 is what gets set), with write8 wrapped to also log every
// hardware store's (addr, value, busOffset). A caller return address is seated
// on the stack (work RAM) so the routine's `ret` pops a known value.
//
// Asserts: the exact T-state total (30 = 7 ld a,n + 13 ld (nn),a + 10 ret),
// A = 0x01, the store lands on 0xB003 with value 0x01 and the ld-(nn),a bus
// offset of 10, the real latch's sound-enable bit (b3) goes high, and the `ret`
// pops the caller's address.
//
// MUTATION: a mutant that loads A=0x00 (i.e. the sibling loc_4c47's CLEAR
// behaviour). The T-state total is IDENTICAL (30 T), so cycles cannot catch it —
// only the value / latch-effect assertions can, and the test proves they do.
//
// Run: node --test games/thepit/translated/test/loc_4c4d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c4d } from "../loc_4c4d.js";

// Machine double over the REAL AddressSpace + Io. write8 is wrapped to log each
// hardware store's busOffset (the real _trace path only records it when a write
// trace is armed); the underlying store still hits the genuine LS259 latch.
function makeMachine() {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this leaf
  const io = new Io();
  const mem = new AddressSpace(rom, io);
  const hwWrites = [];
  const realWrite8 = mem.write8.bind(mem);
  mem.write8 = (a, v, busOffset) => {
    if (AddressSpace.isHardwareWrite(a & 0xffff)) {
      hwWrites.push({ addr: a & 0xffff, value: v & 0xff, busOffset });
    }
    realWrite8(a, v, busOffset);
  };

  const m = {
    regs: new Regs(),
    io,
    mem,
    hwWrites,
    calls: [],
    tstates: 0,
    pc: 0x4c4d,
    steps: [],
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
      this.steps.push(nextAddr);
    },
    push16(v) {
      this.regs.sp = (this.regs.sp - 2) & 0xffff;
      mem.write8(this.regs.sp, v & 0xff);
      mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(this.regs.sp);
      const hi = mem.read8((this.regs.sp + 1) & 0xffff);
      this.regs.sp = (this.regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) {
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // loc_4c4d makes no calls
    },
  };
  return m;
}

const CALLER_RET = 0xabcd;

// Seat a caller return address on the stack (inside work RAM) so `ret` pops a
// known value, then drop the seating stores from the hardware log (they are work
// RAM, not hardware -- so nothing is logged -- but clear defensively).
function run(m, mutant) {
  m.regs.sp = 0x8780; // inside work RAM (0x8000-0x87FF)
  m.push16(CALLER_RET);
  m.hwWrites.length = 0;
  m.regs.a = 0xff; // poison A so a golden A==0x01 can only come from `ld a,0x01`
  (mutant || loc_4c4d)(m);
}

function assertGolden(m) {
  assert.equal(m.tstates, 30, "T-state total (7 ld a,n + 13 ld(nn),a + 10 ret)");
  assert.equal(m.regs.a, 0x01, "A = 0x01 -- the SET datum (not the sibling's 0x00)");
  assert.deepEqual(m.steps, [0x4c4f, 0x4c52, CALLER_RET], "step targets: ld(nn),a, ret opcode, popped caller");
  assert.equal(m.pc, CALLER_RET, "ret popped the caller's return address");
  assert.deepEqual(m.calls, [], "no calls -- store then ret");
  assert.equal(m.hwWrites.length, 1, "exactly one hardware store -- the latch write");
  const w = m.hwWrites[0];
  assert.equal(w.addr, 0xb003, "store lands on the LS259 latch address 0xB003 (bit 3)");
  assert.equal(w.value, 0x01, "latch datum written 0x01 -- SET, NOT the sibling's 0x00");
  assert.equal(w.busOffset, 10, "ld (nn),a write-bus offset is 10");
  assert.equal(m.io.latch & 0x08, 0x08, "real LS259: sound-enable bit 3 is high");
}

test("loc_4c4d: writes A=0x01 to 0xB003, sets sound-enable latch b3, 30 T, rets", () => {
  const m = makeMachine();
  run(m);
  assertGolden(m);
});

// -- MUTATION: SET turned into CLEAR (the sibling loc_4c47 behaviour) --------------
// Load A=0x00 instead of 0x01. The instruction shape and every T-state are
// IDENTICAL (30 T total), so the cycle assertion is blind to it -- only the value
// and the real latch bit reveal that sound-enable was written LOW. The golden
// assertion must reject the mutant.
test("loc_4c4d MUTATION: A=0x00 (mute, not enable) is caught by the value/latch checks", () => {
  function loc_4c4d_mutant(m) {
    const { regs, mem } = m;
    regs.a = 0x00; // BUG: should be 0x01 -- this is the sibling loc_4c47's CLEAR
    m.step(0x4c4f, 7);
    mem.write8(0xb003, regs.a, 10);
    m.step(0x4c52, 13);
    m.ret(10);
  }

  const m = makeMachine();
  run(m, loc_4c4d_mutant);

  // Cycles are unchanged -- the mutation is invisible to the T-state total.
  assert.equal(m.tstates, 30, "mutation preserves the cycle total (only value differs)");
  assert.equal(m.io.latch & 0x08, 0x00, "mutant leaves sound-enable LOW -- the observable break");
  assert.throws(
    () => assertGolden(m),
    /A = 0x01|SET|sound-enable/,
    "the golden value/latch assertion must reject the CLEAR mutant",
  );
});
