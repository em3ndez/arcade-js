// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated sub_3d7e (ROM 0x3d7e-0x3d89), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs, over a zeroed fake
// ROM (the copyrighted image is never committed — the routine touches only work
// RAM 0x8057). The tail-jump callee 0x3e01 is stubbed as a bare "pop-and-return"
// that balances the stack and adds no cycles, so the asserted T-state total is
// sub_3d7e's OWN instruction cost: 13+4+7+13+10 = 47 T.
//
// The routine's identity is the `and 0xf7` mask (bit 3 cleared each bump), so we
// seed 0x8057 = 0x07: the correct run increments to 0x08 and masks it back to
// 0x00 (a modulo-8 wrap). Two mutations are checked:
//   1. SEMANTIC  (and 0xff instead of and 0xf7) — same cycles, but 0x8057 ends
//      0x08 not 0x00 and A/flags differ; only the memory/register/flag asserts
//      catch it (a cycle-only check would miss it).
//   2. CYCLE     (ld a,(nn) charged 7 T not 13) — moves no memory; only the
//      T-state assertion catches it (docs/03: timing invisible to the state diff).

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs, F_Z, F_H, F_PV } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_3d7e } from "../sub_3d7e.js";

const CTR = 0x8057; // the counter byte this routine bumps (mask bit 3 off)
const SEED = 0x07; // 0x07 + 1 = 0x08 -> masked by 0xf7 -> 0x00 (the wrap case)

const SENTINEL = 0xbeef; // caller's return address; the tail-jump's ret must land here
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// -- expected results of the correct run ------------------------------------
const EXP_CTR = 0x00; // (0x07 + 1) & 0xf7
const EXP_A = 0x00;
// `and` sets: sz8(0)=Z, H always, parity8(0)=even => PV. C and N cleared.
const EXP_F = F_Z | F_H | F_PV; // 0x54
const EXP_CYCLES = 13 + 4 + 7 + 13 + 10; // 47 (stubbed callee adds 0)

// -- minimal machine: real mem/io/regs + the step/call seam -----------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3d7e;
    this.calls = [];
    this.regs.sp = SP0;
  }
  step(nextAddr, t) {
    this.pc = nextAddr;
    this.cycles += t;
  }
  push16(v) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, v & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
  }
  pop16() {
    const lo = this.mem.read8(this.regs.sp);
    const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
    this.regs.sp = (this.regs.sp + 2) & 0xffff;
    return lo | (hi << 8);
  }
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address the
  // JP left on the stack -- for a tail-jump that is OUR caller's return). No
  // cycle charge -- the callee's cost is not ours.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

function run(fn, seed = SEED) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  m.mem.write8(CTR, seed);
  m.push16(SENTINEL); // caller's return address (consumed by the tail-jump's ret)
  fn(m);
  return {
    cycles: m.cycles,
    ctr: m.mem.read8(CTR),
    a: m.regs.a,
    f: m.regs.f,
    pc: m.pc,
    sp: m.regs.sp,
    calls: m.calls,
  };
}

// Full spec, factored so each mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total (47)");
  assert.equal(res.ctr, EXP_CTR, "0x8057 = (v+1) & 0xf7 -> 0x00 (bit 3 masked)");
  assert.equal(res.a, EXP_A, "A holds the masked value 0x00");
  assert.equal(res.f, EXP_F, "flags from `and 0xf7`: Z|H|PV = 0x54");
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced (jp pushed nothing)");
  assert.deepEqual(res.calls, [0x3e01], "tail-jumps into sub_3e01 exactly once");
}

test("sub_3d7e: bump 0x8057 masking bit 3, tail-jump 0x3e01; 47 T", () => {
  checkSpec(run(sub_3d7e));
});

// A sanity anchor for the mask: a value that does NOT hit bit 3 counts normally.
test("sub_3d7e: 0x03 + 1 = 0x04 (no bit-3 involvement)", () => {
  const res = run(sub_3d7e, 0x03);
  assert.equal(res.ctr, 0x04, "0x8057 incremented to 0x04");
  assert.equal(res.a, 0x04, "A = 0x04");
  assert.equal(res.cycles, EXP_CYCLES, "same 47 T");
});

// -- MUTATION 1 (SEMANTIC): `and 0xff` instead of `and 0xf7` -- forgets to mask
// bit 3. Same cycle total, but with SEED 0x07 the stored byte is 0x08 not 0x00,
// and A/flags differ. Only the memory/register/flag asserts expose it.
function sub_3d7e_maskMutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8057);
  m.step(0x3d81, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x3d82, 4);
  regs.and(0xff); // BUG: should be 0xf7 -- bit 3 no longer cleared
  m.step(0x3d84, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x3d87, 13);
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}

test("mutation (and 0xff drops the bit-3 mask) is caught by the memory/flag asserts", () => {
  const bad = run(sub_3d7e_maskMutant);
  assert.equal(bad.cycles, EXP_CYCLES, "cycles UNCHANGED -- a cycle-only diff misses this");
  assert.equal(bad.ctr, 0x08, "mutant leaves 0x08 in 0x8057 (bit 3 intact)");
  assert.notEqual(bad.f, EXP_F, "flags differ (parity/zero)");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});

// -- MUTATION 2 (CYCLE): charge `ld a,(0x8057)` 7 T instead of 13. Moves no
// memory -- only the T-state total (6 T short) exposes it.
function sub_3d7e_cycleMutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8057);
  m.step(0x3d81, 7); // BUG: LD A,(nn) is 13 T, not 7
  regs.a = regs.inc8(regs.a);
  m.step(0x3d82, 4);
  regs.and(0xf7);
  m.step(0x3d84, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x3d87, 13);
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}

test("mutation (ld a,(nn) mischarged 7 T) is caught by the cycle assertion", () => {
  const bad = run(sub_3d7e_cycleMutant);
  assert.equal(bad.ctr, EXP_CTR, "memory identical -- a state-only diff would miss this");
  assert.equal(bad.a, EXP_A, "register identical too");
  assert.equal(bad.cycles, EXP_CYCLES - 6, "mutant is exactly 6 T short");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});
