// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_3d49 (ROM 0x3d49-0x3d7d), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. The routine reads
// no ROM (every load is an immediate), so the seeded ROM is inert -- it only has
// to be the exact 20480 bytes AddressSpace demands. The four callees (0x3dae,
// 0x3dc9, 0x3dea, 0x3ddb) and the tail-jump target (0x3e01) are stubbed as
// "pop-and-return" routines that balance the stack but charge no cycles, so the
// asserted T-state total is loc_3d49's OWN instruction cost.
//
// The mutation is a CYCLE-ONLY break (the first `ld ix,nn` charged 10 T like a
// `ld hl,nn`, dropping the DD prefix's 4 T). It moves no memory -- every RAM
// byte is byte-identical -- so ONLY the T-state assertion catches it. That is
// the whole point of charging cycles (docs/translation.md): a timing error
// invisible to the state diff.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_3d49 } from "../loc_3d49.js";

// -- expected T-states: this routine's own instruction cost (stubs add 0) ------
//   ld a,n = 7 ; ld (nn),a = 13 ; call = 17 ; ld ix,nn = 14 ; jp = 10
const EXP_CYCLES =
  7 + 13 + 7 + 13 + // ld a,0x01 / (0x8058) / ld a,0x0c / (0x8059)
  17 + 17 +         // call 0x3dae / call 0x3dc9
  7 + 13 + 7 + 13 + // ld a,0x06 / (0x8057) / ld a,0x01 / (0x8055)
  14 + 17 +         // ld ix,0x8000 / call 0x3dea
  7 + 13 +          // ld a,0x08 / (0x8055)
  14 + 17 +         // ld ix,0x496d / call 0x3ddb
  7 + 13 +          // ld a,0x09 / (0x8055)
  10;               // jp 0x3e01
// == 246

const SENTINEL = 0xbeef; // return address the tail-jump's callee `ret` lands on
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)

// Distinctive entry state: A and IX get overwritten; F is never touched and
// must survive verbatim (no instruction here writes F).
const A_IN = 0x77;
const IX_IN = 0x1234;
const F_IN = 0xab;

// -- minimal machine: real mem/io/regs + the step/call seam ------------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x3d49;
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

function run(fn) {
  const rom = new Uint8Array(0x5000); // AddressSpace requires exactly 20480 bytes
  const m = new TestMachine(rom);
  m.push16(SENTINEL); // the caller's return address (consumed by the tail-jump's ret)
  fn(m);
  return {
    cycles: m.cycles,
    calls: m.calls,
    pc: m.pc,
    sp: m.regs.sp,
    a: m.regs.a,
    ix: m.regs.ix,
    f: m.regs.f,
    // the four layout scratch cells this routine writes
    m8055: m.mem.read8(0x8055),
    m8057: m.mem.read8(0x8057),
    m8058: m.mem.read8(0x8058),
    m8059: m.mem.read8(0x8059),
  };
}

// Full spec, factored so the mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total (246)");
  assert.deepEqual(
    res.calls,
    [0x3dae, 0x3dc9, 0x3dea, 0x3ddb, 0x3e01],
    "call sequence: 2 addr-setup, 2 draw, then the tail-jump target",
  );
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced");
  assert.equal(res.a, 0x09, "A = last-written run-length 0x09");
  assert.equal(res.ix, 0x496d, "IX = last-loaded source pointer 0x496d");
  assert.equal(res.f, F_IN, "F untouched -- no instruction here writes flags");
  assert.equal(res.m8055, 0x09, "0x8055 run-length ends at 0x09 (last of 0x01,0x08,0x09)");
  assert.equal(res.m8057, 0x06, "0x8057 attribute = 0x06");
  assert.equal(res.m8058, 0x01, "0x8058 column = 0x01");
  assert.equal(res.m8059, 0x0c, "0x8059 row = 0x0c");
}

test("loc_3d49: sets layout cells, dispatches draw helpers, tail-jumps 0x3e01; 246 T", () => {
  checkSpec(run(loc_3d49));
});

// -- MUTATION: charge the first `ld ix,0x8000` 10 T instead of 14 (as if it were
// a `ld hl,nn`, i.e. forgetting the DD prefix's 4 T). Moves NO memory -- every
// RAM byte, the call list, PC and SP are byte-identical -- so only the T-state
// total (4 T short) exposes it. Proves the cycle assertion earns its keep.
function loc_3d49_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x3d4b, 7);
  mem.write8(0x8058, regs.a);
  m.step(0x3d4e, 13);
  regs.a = 0x0c;
  m.step(0x3d50, 7);
  mem.write8(0x8059, regs.a);
  m.step(0x3d53, 13);
  m.push16(0x3d56);
  m.step(0x3dae, 17);
  m.call(0x3dae);
  m.push16(0x3d59);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);
  regs.a = 0x06;
  m.step(0x3d5b, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x3d5e, 13);
  regs.a = 0x01;
  m.step(0x3d60, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x3d63, 13);
  regs.ix = 0x8000;
  m.step(0x3d67, 10); // BUG: ld ix,nn is 14 T, not 10
  m.push16(0x3d6a);
  m.step(0x3dea, 17);
  m.call(0x3dea);
  regs.a = 0x08;
  m.step(0x3d6c, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x3d6f, 13);
  regs.ix = 0x496d;
  m.step(0x3d73, 14);
  m.push16(0x3d76);
  m.step(0x3ddb, 17);
  m.call(0x3ddb);
  regs.a = 0x09;
  m.step(0x3d78, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x3d7b, 13);
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}

test("mutation (ld ix mischarged 10 T) is caught by the cycle assertion", () => {
  const bad = run(loc_3d49_mutant);
  // Everything except cycles is byte-identical -- a state-only diff would MISS this.
  assert.equal(bad.m8055, 0x09, "RAM identical to the correct run");
  assert.equal(bad.a, 0x09, "A identical to the correct run");
  assert.equal(bad.ix, 0x496d, "IX identical to the correct run");
  assert.deepEqual(bad.calls, [0x3dae, 0x3dc9, 0x3dea, 0x3ddb, 0x3e01], "calls identical");
  assert.equal(bad.cycles, EXP_CYCLES - 4, "mutant is exactly 4 T short");
  // The spec the real routine passes MUST reject the mutant.
  assert.throws(() => checkSpec(bad));
});
