// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4c5b (ROM 0x4c5b -> shared tail 0x4ca5-0x4cbe, The Pit).
// loc_4c5b loads A=0x03 and unconditionally `jr 0x4ca5` into the shared enqueue
// tail loc_4ca5, which ORs the code with 0x80, pushes DE/HL, writes the command
// byte into the 8-slot ring buffer at 0x8020 using the OLD head index (0x801e),
// advances that index mod 8, then pops HL/DE and rets. This test asserts the exact
// T-state total (162), the per-instruction step boundaries, the return (m.ret,
// not a tail-jump call), and the load-bearing effects: A = code|0x80 = 0x83, the
// ring slot written at base+OLD-index, the head-index advance (incl. the mod-8
// wrap), and DE/HL + SP fully preserved. A mutation that ORs the wrong immediate
// (byte-identical cycles) proves the value/memory assertions carry the weight.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4c5b } from "../loc_4c5b.js";

// Minimal faithful machine double: real Regs/AddressSpace/Io; step records the
// PC boundary and charges cycles; ret marks the return and charges 10T (the C9
// default); push16/pop16 are backed by the real SP + work RAM so DE/HL round-trip
// exactly as the hardware stack would. loc_4c5b has NO m.call (it inlines the
// shared tail and rets), so no call stub is needed.
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM
    this.cycles = 0;
    this.pc = 0x4c5b;
    this.steps = [];
    this.returned = false;
  }
  step(nextAddr, cycles) {
    this.pc = nextAddr;
    this.cycles += cycles;
    this.steps.push(nextAddr);
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
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
}

const SP0 = 0x8780;

// Single straight-line path: entry (7+12) + the 16-instruction tail + ret(10).
const EXPECT_STEPS = [
  0x4c5d, 0x4ca5, // ld a,0x03 ; jr 0x4ca5
  0x4ca7, 0x4ca8, 0x4ca9, 0x4caa, 0x4cad, 0x4cae, 0x4caf, 0x4cb1,
  0x4cb4, 0x4cb7, 0x4cb8, 0x4cba, 0x4cbb, 0x4cbc, 0x4cbd, 0x4cbe,
];
const EXPECT_CYCLES =
  7 + 12 + // loc_4c5b: ld a,0x03 ; jr 0x4ca5
  7 + 11 + 11 + 4 + 13 + 4 + 4 + 7 + 13 + 10 + 4 + 7 + 11 + 7 + 10 + 10 + // loc_4ca5 body
  10; // ret
// = 162

test("loc_4c5b: enqueues 0x83 at ring base+old-index, advances head, preserves DE/HL", () => {
  const m = new MockMachine();
  m.regs.a = 0xff; // prove `ld a,0x03` overwrites A (the door's whole job)
  m.regs.de = 0xbeef; // sentinel -- must be restored by pop de
  m.regs.hl = 0xcafe; // sentinel -- must be restored by pop hl
  m.mem.write8(0x801e, 0x05); // ring head index = 5

  loc_4c5b(m);

  // Control flow: straight line, ends in a real ret at 0x4cbe.
  assert.deepEqual(m.steps, EXPECT_STEPS, "step targets (instruction boundaries)");
  assert.equal(m.returned, true, "ends with ret (m.ret), not a tail-jump");
  assert.equal(m.pc, 0x4cbe, "final PC = the ret instruction");
  assert.equal(m.cycles, EXPECT_CYCLES, "T-state total = 162");

  // Value + memory effects.
  assert.equal(m.regs.a, 0x83, "A = code | 0x80 = 0x03 | 0x80");
  assert.equal(m.mem.read8(0x8025), 0x83, "ring[base + OLD index 5] = command byte");
  assert.equal(m.mem.read8(0x801e), 0x06, "head index advanced to (5 + 1) & 7");

  // The ONLY slot touched is base+old-index; the next slot must stay clear.
  assert.equal(m.mem.read8(0x8026), 0x00, "slot at the ADVANCED index untouched (write used OLD index)");

  // DE, HL and SP are preserved by the push/pop bracketing.
  assert.equal(m.regs.de, 0xbeef, "DE restored by pop de");
  assert.equal(m.regs.hl, 0xcafe, "HL restored by pop hl");
  assert.equal(m.regs.sp, SP0, "SP net-zero (two pushes, two pops)");
});

test("loc_4c5b: head index wraps 7 -> 0 (and 0x07), slot 7 written", () => {
  const m = new MockMachine();
  m.mem.write8(0x801e, 0x07); // head at the last slot
  loc_4c5b(m);
  assert.equal(m.mem.read8(0x8027), 0x83, "ring[base + 7] = command byte");
  assert.equal(m.mem.read8(0x801e), 0x00, "head index wraps (7 + 1) & 7 = 0");
});

// ---- MUTATION --------------------------------------------------------------
// Byte-identical to loc_4c5b EXCEPT `or 0x80` becomes `or 0x00` (a "wrong
// immediate" slip: F6 00 vs F6 80, still 7T so the CYCLE total is unchanged at
// 162). The enqueued byte would then be 0x03, not 0x83 -- so it is precisely the
// A-value and ring-slot assertions that must reject it, proving they are not
// riding on the cycle count.
function loc_4c5b_MUTANT(m) {
  const { regs, mem } = m;
  regs.a = 0x03;
  m.step(0x4c5d, 7);
  m.step(0x4ca5, 12);
  regs.or(0x00); // BUG: should be or 0x80 (drops the command high bit)
  m.step(0x4ca7, 7);
  m.push16(regs.de);
  m.step(0x4ca8, 11);
  m.push16(regs.hl);
  m.step(0x4ca9, 11);
  regs.d = regs.a;
  m.step(0x4caa, 4);
  regs.a = mem.read8(0x801e);
  m.step(0x4cad, 13);
  regs.e = regs.a;
  m.step(0x4cae, 4);
  regs.a = regs.inc8(regs.a);
  m.step(0x4caf, 4);
  regs.and(0x07);
  m.step(0x4cb1, 7);
  mem.write8(0x801e, regs.a);
  m.step(0x4cb4, 13);
  regs.hl = 0x8020;
  m.step(0x4cb7, 10);
  regs.a = regs.d;
  m.step(0x4cb8, 4);
  regs.d = 0x00;
  m.step(0x4cba, 7);
  regs.addHl(regs.de);
  m.step(0x4cbb, 11);
  mem.write8(regs.hl, regs.a);
  m.step(0x4cbc, 7);
  regs.hl = m.pop16();
  m.step(0x4cbd, 10);
  regs.de = m.pop16();
  m.step(0x4cbe, 10);
  m.ret();
}

test("MUTATION caught: or 0x00 instead of or 0x80 (cycles identical)", () => {
  const good = new MockMachine();
  good.mem.write8(0x801e, 0x05);
  loc_4c5b(good);
  assert.equal(good.regs.a, 0x83); // sanity: the real routine sets the high bit

  const bad = new MockMachine();
  bad.mem.write8(0x801e, 0x05);
  loc_4c5b_MUTANT(bad);
  assert.equal(bad.cycles, EXPECT_CYCLES, "mutant preserves the 162T total (cycles cannot catch it)");
  assert.equal(bad.regs.a, 0x03, "mutant dropped the 0x80 command bit");
  assert.equal(bad.mem.read8(0x8025), 0x03, "mutant enqueued the wrong byte");
  // The value/memory assertions must reject it even though cycles match.
  assert.notEqual(bad.regs.a, 0x83, "A assertion has teeth");
  assert.throws(
    () => assert.equal(bad.mem.read8(0x8025), 0x83, "ring slot"),
    "ring-slot assertion rejects the mutant",
  );
});
