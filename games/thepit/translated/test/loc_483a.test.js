// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_483a (ROM 0x483a-0x4893), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. The routine reads
// only 0x802b (RAM); every other load is an immediate, so the seeded ROM is
// inert -- it only has to be the exact 20480 bytes AddressSpace demands. The
// three callees (0x3dae, 0x3dc9, 0x3dea) and the tail-jump target (0x3e01) are
// stubbed as "pop-and-return" routines that balance the stack but charge no
// cycles, so the asserted T-state total is loc_483a's OWN instruction cost and
// the register/memory effects are isolated from the callees'.
//
// loc_483a's defining feature is the two-way branch on (0x802b): `dec a` then
// `jr z,0x4875`. Both arms are exercised (fall-through when 0x802b != 1, the
// loc_4875 arm when 0x802b == 1). The MUTATION inverts that branch condition, so
// on the fall-through input the mutant runs the WRONG arm -- caught by memory,
// the call list AND the cycle total at once, proving the spec has teeth on the
// control flow that distinguishes this routine from its siblings.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_483a } from "../loc_483a.js";

// -- expected T-states, this routine's own instruction cost (stubs add 0) ------
//   ld a,n = 7 ; ld (nn),a = 13 ; ld a,(nn) = 13 ; dec a = 4
//   jr z    = 12 taken / 7 not taken ; call = 17 ; ld ix,nn = 14 ; jp = 10
const EXP_CYCLES_FALLTHROUGH =
  7 + 13 + 13 + 4 + 7 + // ld a,0x05 / (0x8058) / ld a,(0x802b) / dec a / jr z NOT taken
  7 + 13 +              // ld a,0x0b / (0x8059)
  17 + 17 +             // call 0x3dae / call 0x3dc9
  7 + 13 +              // ld a,0x97 / (0x8057)
  7 + 13 +              // ld a,0x09 / (0x8055)
  14 + 17 +             // ld ix,0x49ba / call 0x3dea
  7 + 13 +              // ld a,0x01 / (0x8055)
  14 + 17 +             // ld ix,0x802b / call 0x3dea
  7 + 13 +              // ld a,0x0a / (0x8055)
  10;                   // jp 0x3e01
// == 250
const EXP_CYCLES_BRANCH =
  7 + 13 + 13 + 4 + 12 + // ld a,0x05 / (0x8058) / ld a,(0x802b) / dec a / jr z TAKEN
  7 + 13 +               // ld a,0x0c / (0x8059)
  17 + 17 +              // call 0x3dae / call 0x3dc9
  7 + 13 +               // ld a,0x96 / (0x8057)
  7 + 13 +               // ld a,0x08 / (0x8055)
  14 + 17 +              // ld ix,0x49c2 / call 0x3dea
  10;                    // jp 0x3e01
// == 184

const SENTINEL = 0xbeef; // caller return address the tail-jump's callee `ret` lands on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// Distinctive entry state: A and IX get overwritten; F enters with CARRY SET so
// the test can prove `dec a` preserves carry while setting S/Z/H/PV/N.
const A_IN = 0x77;
const IX_IN = 0x1234;
const F_IN = F_C; // 0x01

// -- minimal machine: real mem/io/regs + the step/call seam ------------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x483a;
    this.calls = [];
    this.regs.sp = SP0;
    this.regs.a = A_IN;
    this.regs.ix = IX_IN;
    this.regs.f = F_IN;
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
  // CALL/JP left on the stack). No cycle charge -- the callee's cost is not ours.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

// Run `fn` with (0x802b) = sel. Pushes the caller return address first, exactly
// as a real CALL into loc_483a would leave it, so the tail-jump's ret has a
// target and the stack balances.
function run(fn, sel) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  m.mem.write8(0x802b, sel);
  m.push16(SENTINEL);
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    ix: m.regs.ix,
    f: m.regs.f,
    fZ: m.regs.fZ,
    fC: m.regs.fC,
    // the four layout scratch cells this routine writes
    m8055: m.mem.read8(0x8055),
    m8057: m.mem.read8(0x8057),
    m8058: m.mem.read8(0x8058),
    m8059: m.mem.read8(0x8059),
  };
}

// -- PATH 1: fall-through (0x802b != 1) --------------------------------------
// Full spec, factored so the mutant runs through the identical checks.
function checkFallThrough(res) {
  assert.equal(res.cycles, EXP_CYCLES_FALLTHROUGH, "T-state total, jr NOT taken (250)");
  assert.deepEqual(
    res.calls,
    [0x3dae, 0x3dc9, 0x3dea, 0x3dea, 0x3e01],
    "fall-through calls: 2 addr-setup, 2 draws (0x3dea twice), then tail-jump target",
  );
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
  assert.equal(res.a, 0x0a, "A = last-written run-length 0x0a");
  assert.equal(res.ix, 0x802b, "IX = last-loaded pointer 0x802b (callees stubbed, so unmodified)");
  // dec a of 0x02 -> 0x01: Z clear, N set; carry passed through from entry (set).
  assert.equal(res.fZ, false, "0x802b != 1 -> dec a nonzero -> Z clear");
  assert.equal(res.fC, true, "dec a preserves the entry carry");
  assert.equal(res.f, 0x03, "F = N | C (dec 0x02->0x01, carry preserved)");
  assert.equal(res.m8058, 0x05, "0x8058 column = 0x05 (set before the branch)");
  assert.equal(res.m8059, 0x0b, "0x8059 row = 0x0b (fall-through variant)");
  assert.equal(res.m8057, 0x97, "0x8057 attribute = 0x97 (fall-through variant)");
  assert.equal(res.m8055, 0x0a, "0x8055 run-length ends at 0x0a (last of 0x09,0x01,0x0a)");
}

// -- PATH 2: loc_4875 (0x802b == 1) ------------------------------------------
function checkBranch(res) {
  assert.equal(res.cycles, EXP_CYCLES_BRANCH, "T-state total, jr TAKEN (184)");
  assert.deepEqual(
    res.calls,
    [0x3dae, 0x3dc9, 0x3dea, 0x3e01],
    "branch calls: 2 addr-setup, 1 draw, then tail-jump target",
  );
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
  assert.equal(res.a, 0x08, "A = last-written run-length 0x08");
  assert.equal(res.ix, 0x49c2, "IX = last-loaded pointer 0x49c2 (callees stubbed)");
  // dec a of 0x01 -> 0x00: Z set, N set; carry passed through from entry (set).
  assert.equal(res.fZ, true, "0x802b == 1 -> dec a zero -> Z set");
  assert.equal(res.fC, true, "dec a preserves the entry carry");
  assert.equal(res.f, 0x43, "F = Z | N | C (dec 0x01->0x00, carry preserved)");
  assert.equal(res.m8058, 0x05, "0x8058 column = 0x05 (set before the branch)");
  assert.equal(res.m8059, 0x0c, "0x8059 row = 0x0c (loc_4875 variant)");
  assert.equal(res.m8057, 0x96, "0x8057 attribute = 0x96 (loc_4875 variant)");
  assert.equal(res.m8055, 0x08, "0x8055 run-length = 0x08 (loc_4875 variant)");
}

test("loc_483a fall-through (0x802b != 1): 0x0b/0x97 panel, 4 draws via 0x3dea x2; 250 T", () => {
  checkFallThrough(run(loc_483a, 0x02));
});

test("loc_483a branch (0x802b == 1): loc_4875 0x0c/0x96 panel, 1 draw; 184 T", () => {
  checkBranch(run(loc_483a, 0x01));
});

// -- MUTATION: invert the branch condition (`jr z` treated as `jr nz`). --------
// On the fall-through input (0x802b = 0x02) the real routine falls through, but
// the mutant takes the loc_4875 arm -- writing the WRONG panel, the wrong call
// list AND the wrong T-total. checkFallThrough must reject it.
function loc_483a_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x05;
  m.step(0x483c, 7);
  mem.write8(0x8058, regs.a);
  m.step(0x483f, 13);
  regs.a = mem.read8(0x802b);
  m.step(0x4842, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x4843, 4);
  if (regs.fNZ) { // BUG: real routine branches on fZ (jr z), not fNZ
    m.step(0x4875, 12);
    regs.a = 0x0c;
    m.step(0x4877, 7);
    mem.write8(0x8059, regs.a);
    m.step(0x487a, 13);
    m.push16(0x487d);
    m.step(0x3dae, 17);
    m.call(0x3dae);
    m.push16(0x4880);
    m.step(0x3dc9, 17);
    m.call(0x3dc9);
    regs.a = 0x96;
    m.step(0x4882, 7);
    mem.write8(0x8057, regs.a);
    m.step(0x4885, 13);
    regs.a = 0x08;
    m.step(0x4887, 7);
    mem.write8(0x8055, regs.a);
    m.step(0x488a, 13);
    regs.ix = 0x49c2;
    m.step(0x488e, 14);
    m.push16(0x4891);
    m.step(0x3dea, 17);
    m.call(0x3dea);
    m.step(0x3e01, 10);
    return m.call(0x3e01);
  }
  m.step(0x4845, 7);
  regs.a = 0x0b;
  m.step(0x4847, 7);
  mem.write8(0x8059, regs.a);
  m.step(0x484a, 13);
  m.push16(0x484d);
  m.step(0x3dae, 17);
  m.call(0x3dae);
  m.push16(0x4850);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);
  regs.a = 0x97;
  m.step(0x4852, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x4855, 13);
  regs.a = 0x09;
  m.step(0x4857, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x485a, 13);
  regs.ix = 0x49ba;
  m.step(0x485e, 14);
  m.push16(0x4861);
  m.step(0x3dea, 17);
  m.call(0x3dea);
  regs.a = 0x01;
  m.step(0x4863, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x4866, 13);
  regs.ix = 0x802b;
  m.step(0x486a, 14);
  m.push16(0x486d);
  m.step(0x3dea, 17);
  m.call(0x3dea);
  regs.a = 0x0a;
  m.step(0x486f, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x4872, 13);
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}

test("mutation (inverted jr z -> jr nz) is caught: wrong arm on the fall-through input", () => {
  // Sanity: the real routine passes its own spec on this input.
  checkFallThrough(run(loc_483a, 0x02));

  const bad = run(loc_483a_mutant, 0x02);
  // The mutant ran the loc_4875 arm instead of falling through.
  assert.equal(bad.m8059, 0x0c, "mutant wrote the loc_4875 row 0x0c, not the fall-through 0x0b");
  assert.equal(bad.cycles, EXP_CYCLES_BRANCH, "mutant charged the branch-arm total (184), not 250");
  assert.deepEqual(bad.calls, [0x3dae, 0x3dc9, 0x3dea, 0x3e01], "mutant took the 1-draw call path");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkFallThrough(bad), "the fall-through spec must reject the wrong-arm mutant");
});
