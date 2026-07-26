// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4ca5 (ROM 0x4CA5-0x4CBE, The Pit): the shared
// sound-request ENQUEUE tail. It ORs bit 7 onto the command index already in A, then
// appends that byte to the 8-entry sound ring buffer at 0x8020, indexed by the write
// pointer at 0x801E (used at its CURRENT value, then advanced `(p + 1) & 0x07`). DE
// and HL are pushed on entry and popped before `ret`, so only A/F and those two RAM
// cells change.
//
// Self-contained: a minimal mock machine (real Regs from z80.js for exact flags, a
// flat 64K RAM, and step/call/ret/push16/pop16 mirroring the DK Machine, plus a pcSeq
// stepcheck log). A caller return address is seated on the stack so the closing `ret`
// pops a known value.
//
// Pinned against the disassembly:
//   * exact 143 T total; instruction-boundary sequence straight off the listing;
//   * ring[0x8020 + current_pointer] = 0x80 | index; the NEXT slot is left untouched
//     (guards the off-by-one); 0x801E advanced (p+1)&7 with wrap 7 -> 0;
//   * A holds the command byte (0x80|index) at exit; DE and HL restored to their
//     entry values (push/pop bracket); `ret` returns to the seated caller address.
//
// TEETH: a faithful twin whose ONLY break is the ring slot sampled from the ADVANCED
// pointer instead of the current one (an off-by-one in the ring index -- as if `ld e,a`
// ran after the inc/and). Same T-states, same step sequence, so ONLY the slot moves:
// the byte lands one cell too far and the intended slot stays 0. The contract catches
// it (ring[0x8023] would be 0, and ring[0x8024] would be written instead).
//
// Run: node --test games/thepit/translated/test/loc_4ca5.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4ca5 } from "../loc_4ca5.js";

const CALLER_RET = 0xabcd; // seated on the stack; the closing `ret` must pop THIS

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs,
    mem,
    ram,
    tstates: 0,
    pc: 0x4ca5,
    pcSeq: [],
    returned: false,
    step(nextAddr, cycles) {
      this.pc = nextAddr;
      this.tstates += cycles;
      this.pcSeq.push(nextAddr);
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
      this.returned = true;
      this.step(this.pop16(), cycles);
    },
    call(addr) {
      throw new Error(`loc_4ca5 makes no CALL; got call(0x${addr.toString(16)})`);
    },
  };
}

// Seat the caller's CALL: put a known return address on the stack (SP well above the
// ring buffer at 0x8020 so the push/pop never touch it).
function seatCaller(m) {
  m.regs.sp = 0x8782;
  m.push16(CALLER_RET); // -> sp = 0x8780 holds 0xABCD
}

const SEED_DE = 0xbeef; // distinctive DE, must be restored by `pop de`
const SEED_HL = 0xcafe; // distinctive HL, must be restored by `pop hl`

// Instruction-boundary sequence straight off the disassembly (the ret's target is the
// seated caller address, appended by ret -> step(pop16(), 10)).
const EXPECTED_PC_SEQ = [
  0x4ca7, 0x4ca8, 0x4ca9, 0x4caa, 0x4cad, 0x4cae, 0x4caf, 0x4cb1,
  0x4cb4, 0x4cb7, 0x4cb8, 0x4cba, 0x4cbb, 0x4cbc, 0x4cbd, 0x4cbe,
  CALLER_RET,
];

// Primary scenario: current ring pointer = 3, entered (like loc_4c9b) with A = 0x13.
// Golden effects live in one function so the mutation test proves the assertions fire.
function assertGolden(m) {
  // Exact local T-state total (all 17 instructions, incl. ret).
  assert.equal(m.tstates, 143, "143 T total");

  // The command byte, bit 7 set, landed in the CURRENT slot (0x8020 + 3).
  assert.equal(m.mem.read8(0x8023), 0x93, "ring[0x8023] = 0x80|0x13 = 0x93");
  // The next slot (the advanced pointer's) must be UNTOUCHED -- guards the off-by-one.
  assert.equal(m.mem.read8(0x8024), 0x00, "advanced slot 0x8024 left untouched");

  // Write pointer advanced (p+1)&7: 3 -> 4.
  assert.equal(m.mem.read8(0x801e), 0x04, "0x801e advanced 3 -> 4");

  // A carries the enqueued command byte out.
  assert.equal(m.regs.a, 0x93, "A = the enqueued command byte (0x93) at exit");

  // DE and HL restored by the push/pop bracket.
  assert.equal(m.regs.de, SEED_DE, "DE restored by pop de");
  assert.equal(m.regs.hl, SEED_HL, "HL restored by pop hl");

  // Control flow: ret popped the seated caller address; SP back to its pre-call spot.
  assert.equal(m.returned, true, "ret executed");
  assert.equal(m.pc, CALLER_RET, "ret returned to the seated caller (0xABCD)");
  assert.equal(m.regs.sp, 0x8782, "SP unwound to its pre-call value");

  // stepcheck: every step target is a real instruction boundary, in order.
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "step targets match the disassembly boundaries");
}

function runGolden(routine) {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = SEED_DE;
  m.regs.hl = SEED_HL;
  m.mem.write8(0x801e, 0x03); // current ring write pointer = slot 3
  m.regs.a = 0x13;            // entered with command index 0x13 (as loc_4c9b does)
  const ret = routine(m);
  return { m, ret };
}

test("loc_4ca5: enqueues 0x80|index into ring[pointer], advances the pointer, 143 T", () => {
  const { m } = runGolden(loc_4ca5);
  assertGolden(m);
  console.log("  loc_4ca5: ring[0x8023]=0x93, 0x801e:3->4, DE/HL preserved, ret->0xABCD, 143 T");
});

test("loc_4ca5: pointer wraps 7 -> 0 (and 0x07); writes the last slot", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x801e, 0x07); // pointer at the last slot
  m.regs.a = 0x15;            // loc_4ca3's index
  loc_4ca5(m);
  assert.equal(m.mem.read8(0x8027), 0x95, "ring[0x8027] = 0x80|0x15 = 0x95 (slot 7)");
  assert.equal(m.mem.read8(0x801e), 0x00, "pointer wrapped 7 -> 0 via and 0x07");
});

test("loc_4ca5: or 0x80 always sets bit 7 even on an already-high index", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x801e, 0x00);
  m.regs.a = 0x80; // bit 7 already set -> stays 0x80
  loc_4ca5(m);
  assert.equal(m.mem.read8(0x8020), 0x80, "ring[0x8020] = 0x80 (or 0x80 idempotent)");
});

// -- TEETH -------------------------------------------------------------------
// A faithful copy of loc_4ca5 with EXACTLY ONE break: the ring slot is sampled from
// the ADVANCED pointer instead of the current one -- as if `ld e,a` (4cad) ran AFTER
// the inc/and rather than before. Identical T-states and step sequence; only the slot
// index (E) moves by one. The byte then lands in 0x8024 and the intended 0x8023 stays
// zero -- exactly what the golden guards.
function brokenLoc4ca5(m) {
  const { regs, mem } = m;
  regs.or(0x80);
  m.step(0x4ca7, 7);
  m.push16(regs.de);
  m.step(0x4ca8, 11);
  m.push16(regs.hl);
  m.step(0x4ca9, 11);
  regs.d = regs.a;
  m.step(0x4caa, 4);
  regs.a = mem.read8(0x801e);
  m.step(0x4cad, 13);
  m.step(0x4cae, 4); // ld e,a boundary -- but E is NOT captured here (the bug)
  regs.a = regs.inc8(regs.a);
  m.step(0x4caf, 4);
  regs.and(0x07);
  m.step(0x4cb1, 7);
  regs.e = regs.a; // BUG: slot = ADVANCED pointer (off-by-one), not the current one
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

test("TEETH: the off-by-one ring-slot twin is CAUGHT by the golden contract", () => {
  // The real routine passes.
  assertGolden(runGolden(loc_4ca5).m);

  // The mutant fails: same T-states/steps, but the byte lands one slot too far.
  const { m } = runGolden(brokenLoc4ca5);
  assert.throws(
    () => assertGolden(m),
    /0x8023/,
    "the contract FAILED to catch the ring off-by-one -- it has no teeth",
  );
  // Concretely: intended slot empty, next slot wrongly written.
  assert.equal(m.mem.read8(0x8023), 0x00, "mutant: intended slot 0x8023 left empty");
  assert.equal(m.mem.read8(0x8024), 0x93, "mutant: byte wrongly enqueued into 0x8024");
});
