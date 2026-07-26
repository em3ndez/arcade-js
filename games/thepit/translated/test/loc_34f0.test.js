// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_34f0 (ROM 0x34F0-0x34FD): the once-per-256 periodic
// refresh. It has a single straight-line path: call the LFSR (loc_4b1a),
// `or 0x80` its returned byte, store to 0x808b, then set 0x8084 = 0x09 and ret.
//
// The test pins the exact T-state total (67), the instruction-boundary step
// sequence, the mid-routine CALL (pushed return address 0x34f3 + call target
// 0x4b1a), the `or 0x80` result in A and its flags, both memory writes, and the
// final unconditional ret. The machine double stubs m.call so it does NOT run
// the real loc_4b1a; instead it injects a chosen "LFSR return byte" into A,
// which lets us assert that loc_34f0 forces bit 7 (0x42 -> 0xC2) regardless of
// the callee's internals. A mutation that weakens `or 0x80` to `or 0x00` (a
// no-op, same 7 T-states) is then shown to slip past the cycle count and be
// caught only by the A / 0x808b value assertions.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_S } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_34f0 } from "../loc_34f0.js";

// The byte the stubbed LFSR (loc_4b1a) "returns" in A. Bit 7 is CLEAR on
// purpose so the routine's `or 0x80` has an observable effect (0x42 -> 0xC2).
const LFSR_RETURN = 0x42;

// Minimal machine double: exactly the surface loc_34f0 touches (regs, mem,
// push16, call, step, ret). push16 records the pushed return address; call
// records the target AND injects LFSR_RETURN into A for target 0x4b1a (modelling
// "loc_4b1a ran and left its result in A") without executing the real routine.
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x34f0,
    steps: [],
    calls: [],
    pushes: [],
    returned: false,
    push16(v) {
      this.pushes.push(v);
    },
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x4b1a) this.regs.a = LFSR_RETURN; // callee leaves its result in A
      return undefined;
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

const EXPECT = {
  steps: [0x4b1a, 0x34f5, 0x34f8, 0x34fa, 0x34fd],
  calls: [0x4b1a],
  pushes: [0x34f3], // call 0x4b1a pushes the address of the next instruction
  returned: true,
  cycles: 17 + 7 + 13 + 7 + 13 + 10, // 67
  pc: 0x34fd,
  a: 0x09, // final A: the closing `ld a,0x09` overwrites the masked byte
  m808b: LFSR_RETURN | 0x80, // 0xC2 -- the masked random byte lives here, not in A
  m8084: 0x09,
};

test("loc_34f0: calls the LFSR, forces bit 7, stores 0x808b and arms 0x8084=0x09", () => {
  const m = makeMachine({ 0x808b: 0x00, 0x8084: 0x00 });
  loc_34f0(m);

  assert.deepEqual(m.steps, EXPECT.steps, "step targets / instruction boundaries");
  assert.deepEqual(m.calls, EXPECT.calls, "CALL target");
  assert.deepEqual(m.pushes, EXPECT.pushes, "pushed return address");
  assert.equal(m.returned, EXPECT.returned, "unconditional ret");
  assert.equal(m.cycles, EXPECT.cycles, "T-state total");
  assert.equal(m.pc, EXPECT.pc, "final PC");
  assert.equal(m.regs.a, EXPECT.a, "final A = 0x09 (closing ld a,0x09)");
  assert.equal(m.mem.read8(0x808b), EXPECT.m808b, "0x808b masked random byte (bit 7 forced)");
  assert.equal(m.mem.read8(0x8084), EXPECT.m8084, "0x8084 re-armed to 0x09");
  // The `or 0x80` (result 0xC2) sets S, clears Z, and 0xC2 has odd parity so PV
  // clears; the closing `ld a,0x09` touches no flags, so those survive to the ret.
  assert.equal(m.regs.f, F_S, "or 0x80 flags survive to ret: S set only (Z/PV/H/N/C clear)");
});

test("bit 7 is forced even when the LFSR byte already has it set", () => {
  // Independent of the exact returned byte, 0x808b must always end in 0x80..0xFF.
  const m = makeMachine();
  // Redefine the stub's injected value for this run: 0xF0 already has bit 7.
  m.call = function (addr) {
    this.calls.push(addr);
    if (addr === 0x4b1a) this.regs.a = 0xf0;
    return undefined;
  };
  loc_34f0(m);
  assert.equal(m.mem.read8(0x808b), 0xf0 | 0x80, "0xF0 | 0x80 = 0xF0 (bit 7 stays set)");
  assert.equal(m.mem.read8(0x808b) & 0x80, 0x80, "0x808b bit 7 set");
});

test("mutation: `or 0x00` (weakened mask) is caught by the value assertions, not cycles", () => {
  // Byte-identical to loc_34f0 except `or 0x80` becomes `or 0x00` (a no-op that
  // fails to force bit 7). `or n` is 7 T either way, so the cycle total is
  // UNCHANGED -- only the A register / 0x808b value checks can reject it.
  function loc_34f0_mutant(m) {
    const { regs, mem } = m;
    m.push16(0x34f3);
    m.step(0x4b1a, 17);
    m.call(0x4b1a);
    regs.or(0x00); // BUG: should be or 0x80 (must force bit 7)
    m.step(0x34f5, 7);
    mem.write8(0x808b, regs.a);
    m.step(0x34f8, 13);
    regs.a = 0x09;
    m.step(0x34fa, 7);
    mem.write8(0x8084, regs.a);
    m.step(0x34fd, 13);
    m.ret();
  }

  const m = makeMachine({ 0x808b: 0x00, 0x8084: 0x00 });
  loc_34f0_mutant(m);

  // Cycles match the real routine, proving the count cannot catch this mutation.
  assert.equal(m.cycles, EXPECT.cycles, "mutation preserves the T-state total");
  // The mutant left bit 7 CLEAR: 0x42 instead of 0xC2.
  assert.equal(m.mem.read8(0x808b), LFSR_RETURN, "mutant stored the unmasked byte (bit 7 clear)");
  assert.notEqual(m.mem.read8(0x808b), EXPECT.m808b, "mutant diverges from the real 0x808b value");
});
