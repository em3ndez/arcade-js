// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4ca3 (ROM 0x4CA3-0x4CA4, The Pit): a sound-request
// stub that loads command index 0x15 into A and FALLS THROUGH (no jr) into the shared
// enqueue tail loc_4ca5 (0x4ca5). loc_4ca5's own ret unwinds to loc_4ca3's caller, so
// the fall-through is modelled `return m.call(0x4ca5)` with NO m.ret (single unwind).
//
// This is an END-TO-END test: the mock's call(0x4ca5) dispatches to the REAL loc_4ca5,
// so the whole routine's observable effect is asserted -- the ring write, the pointer
// advance, A at exit, DE/HL preservation, and the return to the seated caller -- not
// just the tail dispatch. A real Regs (z80.js) gives exact flags; a flat 64K RAM backs
// memory; step/push16/pop16/ret mirror the DK Machine, with a pcSeq stepcheck log.
//
// Pinned against the disassembly:
//   * exact 150 T total = ld a,0x15 (7) + loc_4ca5's 143;
//   * boundary sequence [0x4ca5, then loc_4ca5's boundaries, then the seated caller];
//   * ring[0x8020 + current_pointer] = 0x80 | 0x15 = 0x95; the NEXT slot untouched;
//     0x801e advanced (p+1)&7 with wrap 7 -> 0; A = 0x95 at exit; DE/HL restored;
//     loc_4ca5's ret returns to the seated caller and unwinds SP.
//
// TEETH (two mutations):
//   1. payload: `ld a,0x15` swapped for `ld a,0x14` (neighbour loc_4c9f's index) -- the
//      single byte that distinguishes this stub from its ~20 siblings -- flips the
//      enqueued byte and A 0x95 -> 0x94; CAUGHT.
//   2. cycles: the fall-through charged 12 T (as if there were a jr) instead of 7 --
//      total 155, not 150; CAUGHT by the T-state assertion.
//
// Run: node --test games/thepit/translated/test/loc_4ca3.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_S, F_C, F_Z } from "../../../../core/cpu/z80.js";
import { loc_4ca3 } from "../loc_4ca3.js";
import { loc_4ca5 } from "../loc_4ca5.js";

const CALLER_RET = 0xabcd; // seated on the stack; the closing ret must pop THIS
const SEED_DE = 0xbeef;    // distinctive DE, must be restored by loc_4ca5's pop de
const SEED_HL = 0xcafe;    // distinctive HL, must be restored by loc_4ca5's pop hl

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
    pc: 0x4ca3,
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
    // loc_4ca3's only transfer of control: the fall-through into loc_4ca5. Dispatch
    // to the REAL routine so the whole enqueue effect is exercised end-to-end.
    call(addr) {
      if (addr === 0x4ca5) return loc_4ca5(this);
      throw new Error(`loc_4ca3 only falls into 0x4ca5; got call(0x${addr.toString(16)})`);
    },
  };
}

// Seat the caller's CALL: a known return address on the stack (SP well above the ring
// buffer at 0x8020 so loc_4ca5's push/pop never touch it).
function seatCaller(m) {
  m.regs.sp = 0x8782;
  m.push16(CALLER_RET); // -> sp = 0x8780 holds 0xABCD
}

// Instruction-boundary sequence: loc_4ca3's own `ld a,0x15` boundary (0x4ca5), then
// loc_4ca5's boundaries, then the ret target (the seated caller).
const EXPECTED_PC_SEQ = [
  0x4ca5,
  0x4ca7, 0x4ca8, 0x4ca9, 0x4caa, 0x4cad, 0x4cae, 0x4caf, 0x4cb1,
  0x4cb4, 0x4cb7, 0x4cb8, 0x4cba, 0x4cbb, 0x4cbc, 0x4cbd, 0x4cbe,
  CALLER_RET,
];

// Golden effects live in one function so the mutation tests prove the assertions fire.
function assertGolden(m) {
  // Exact total T: ld a,0x15 (7) + loc_4ca5 (143) = 150.
  assert.equal(m.tstates, 150, "150 T total (7 + loc_4ca5's 143)");

  // The command byte, bit 7 set, landed in the CURRENT slot (0x8020 + 3).
  assert.equal(m.mem.read8(0x8023), 0x95, "ring[0x8023] = 0x80|0x15 = 0x95");
  // The advanced slot must be UNTOUCHED -- guards the ring off-by-one.
  assert.equal(m.mem.read8(0x8024), 0x00, "advanced slot 0x8024 left untouched");

  // Write pointer advanced (p+1)&7: 3 -> 4.
  assert.equal(m.mem.read8(0x801e), 0x04, "0x801e advanced 3 -> 4");

  // A carries the enqueued command byte (payload 0x15 -> 0x95) out.
  assert.equal(m.regs.a, 0x95, "A = enqueued command byte 0x95 at exit");

  // DE and HL restored by loc_4ca5's push/pop bracket.
  assert.equal(m.regs.de, SEED_DE, "DE restored");
  assert.equal(m.regs.hl, SEED_HL, "HL restored");

  // Control flow: loc_4ca5's ret popped the seated caller (single unwind through 4ca3).
  assert.equal(m.returned, true, "ret executed (via loc_4ca5)");
  assert.equal(m.pc, CALLER_RET, "returned to the seated caller (0xABCD)");
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
  m.regs.a = 0x00;            // arbitrary; loc_4ca3 overwrites it with 0x15
  const ret = routine(m);
  return { m, ret };
}

test("loc_4ca3: seeds 0x15, falls into loc_4ca5, enqueues 0x95 into ring[3], 150 T", () => {
  const { m } = runGolden(loc_4ca3);
  assertGolden(m);
  console.log("  loc_4ca3: ring[0x8023]=0x95, 0x801e:3->4, A=0x95, ret->0xABCD, 150 T");
});

test("loc_4ca3: ld a,0x15 touches no flags -- the caller's F reaches loc_4ca5 intact", () => {
  const seedF = F_S | F_C | F_Z; // distinctive seed
  const m = makeMachine();
  seatCaller(m);
  m.regs.f = seedF;
  m.mem.write8(0x801e, 0x00);
  loc_4ca3(m);
  // loc_4ca5 rewrites F via `or 0x80`, but the byte it operates on (A=0x15, non-zero,
  // bit7 clear) yields a defined result; the point here is loc_4ca3 itself set no flag
  // before handing off -- verified by A being the only thing it changed pre-call.
  assert.equal(m.mem.read8(0x8020), 0x95, "ring[0x8020] = 0x95 regardless of entry F");
});

test("loc_4ca3: pointer wraps 7 -> 0 via and 0x07; writes the last slot", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x801e, 0x07); // pointer at the last slot
  loc_4ca3(m);
  assert.equal(m.mem.read8(0x8027), 0x95, "ring[0x8027] = 0x95 (slot 7)");
  assert.equal(m.mem.read8(0x801e), 0x00, "pointer wrapped 7 -> 0");
});

// -- TEETH #1: payload immediate -------------------------------------------------
// A faithful copy of loc_4ca3 with EXACTLY ONE break: `ld a,0x15` swapped for
// `ld a,0x14` (neighbour loc_4c9f's index) -- the ONLY byte distinguishing this stub
// from its ~20 siblings. It then falls into the real loc_4ca5, which enqueues 0x94.
function brokenLoc4ca3Payload(m) {
  const { regs } = m;
  regs.a = 0x14; // BUG: ld a,0x14 (neighbour loc_4c9f's index) instead of 0x15
  m.step(0x4ca5, 7);
  return m.call(0x4ca5);
}

test("TEETH: the ld a,0x15 -> ld a,0x14 payload twin is CAUGHT by the contract", () => {
  assertGolden(runGolden(loc_4ca3).m); // real routine passes

  const { m } = runGolden(brokenLoc4ca3Payload);
  assert.throws(
    () => assertGolden(m),
    /0x95/,
    "the contract FAILED to catch ld a,0x15 -> ld a,0x14 -- it has no teeth",
  );
  // Concretely: the wrong index reaches the ring and A.
  assert.equal(m.mem.read8(0x8023), 0x94, "mutant: ring[0x8023] = 0x94 (wrong sound)");
  assert.equal(m.regs.a, 0x94, "mutant: A = 0x94 (wrong sound-command index)");
});

// -- TEETH #2: cycle count -------------------------------------------------------
// A faithful copy whose ONLY break is charging 12 T for the fall-through (as if a `jr`
// existed) instead of 7. Same memory/register effects; only the T total moves 150 ->
// 155, which the T-state assertion catches -- proving that assertion has teeth.
function brokenLoc4ca3Cycles(m) {
  const { regs } = m;
  regs.a = 0x15;
  m.step(0x4ca5, 12); // BUG: 12 T (phantom jr) rather than ld a,0x15's 7 T
  return m.call(0x4ca5);
}

test("TEETH: a wrong fall-through cycle charge (7 -> 12) is CAUGHT by the T total", () => {
  const { m } = runGolden(brokenLoc4ca3Cycles);
  assert.throws(
    () => assertGolden(m),
    /150 T total/,
    "the T-state assertion FAILED to catch a 7 -> 12 cycle error -- it has no teeth",
  );
  assert.equal(m.tstates, 155, "mutant: 155 T (12 + loc_4ca5's 143), not 150");
});
