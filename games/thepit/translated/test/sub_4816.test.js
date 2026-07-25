// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated sub_4816 (ROM 0x4816-0x4839), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. sub_4816 is
// straight-line HUD setup: it writes the cursor/fill/count cells, loads the IX
// source table, makes three ordinary returning calls (0x3dae, 0x3dc9, 0x3ddb),
// and closes with a TAIL-JUMP `jp 0x3e01`.
//
// The three real callees and the tail-jump target are STUBBED as
// "pop-and-return" (balance the stack, charge no cycles) so the asserted T-state
// total is sub_4816's OWN instruction cost and the tail-jump's return lands on
// the caller. A deliberate MUTATION (the closing tail-jump modelled as a normal
// returning `call`, which mischarges the jump and leaves the caller's return on
// the stack) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_4816 } from "../sub_4816.js";

const SENTINEL = 0xbeef; // caller return address the tail-jump must land on
const SP0 = 0x8780; // inside work RAM (0x8000-0x87ff) so pushes are mapped

// -- minimal machine: real mem/io/regs + the step/call/ret seam --------------
class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x4816;
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop the address on
  // the stack). For an ordinary call this pops the return address push16 just
  // put there (net: stack balanced, PC = the call's return); for the tail-jump
  // (no preceding push) it pops the caller sentinel. No cycles -- the callee's
  // own cost is not sub_4816's.
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
  const m = new TestMachine();
  m.push16(SENTINEL); // caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    pc: m.pc,
    sp: m.regs.sp,
    calls: m.calls,
    ix: m.regs.ix,
    a: m.regs.a,
    m8055: m.mem.read8(0x8055),
    m8057: m.mem.read8(0x8057),
    m8058: m.mem.read8(0x8058),
    m8059: m.mem.read8(0x8059),
  };
}

// -- FULL spec the real routine must satisfy ---------------------------------
//   T-states (stubbed 0-cost callees):
//     ld a,n(7) ld(nn),a(13) ld a,n(7) ld(nn),a(13)          = 40
//     call(17) call(17)                                      = 34  -> 74
//     ld a,n(7) ld(nn),a(13) ld a,n(7) ld(nn),a(13)          = 40  -> 114
//     ld ix,nn(14) call(17) jp(10)                           = 41  -> 155
function checkAll(res) {
  assert.equal(res.cycles, 155, "own T-state total");
  assert.equal(res.pc, SENTINEL, "tail-jump `jp 0x3e01` returns to the caller");
  assert.equal(res.sp, SP0, "stack balanced through 3 calls + the tail-jump");
  assert.deepEqual(
    res.calls,
    [0x3dae, 0x3dc9, 0x3ddb, 0x3e01],
    "three returning calls then a tail-jump into sub_3e01",
  );
  assert.equal(res.m8058, 0x01, "0x8058 (column) = 0x01");
  assert.equal(res.m8059, 0x0b, "0x8059 (row) = 0x0b");
  assert.equal(res.m8057, 0x00, "0x8057 (fill byte) = 0x00");
  assert.equal(res.m8055, 0x0a, "0x8055 (strip height) = 0x0a");
  assert.equal(res.ix, 0x494f, "IX = 0x494f (source table)");
  assert.equal(res.a, 0x0a, "A left holding the last immediate (0x0a)");
}

test("sub_4816: writes the HUD cursor/fill/count, loads IX, calls + tail-jumps", () => {
  checkAll(run(sub_4816));
});

// -- MUTATION: the closing tail-jump `jp 0x3e01` modelled as a NORMAL returning
// call (push16 the fall-through addr, charge 17 not 10, then call). The stub
// pops the bogus pushed 0x483a instead of the caller sentinel, so PC lands on
// 0x483a (not the caller), the caller's return is orphaned on the stack (SP off
// by 2), and the jump is mischarged (162 not 155). The full spec MUST reject it.
function sub_4816_mutant(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x4818, 7);
  mem.write8(0x8058, regs.a);
  m.step(0x481b, 13);
  regs.a = 0x0b;
  m.step(0x481d, 7);
  mem.write8(0x8059, regs.a);
  m.step(0x4820, 13);
  m.push16(0x4823);
  m.step(0x3dae, 17);
  m.call(0x3dae);
  m.push16(0x4826);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);
  regs.a = 0x00;
  m.step(0x4828, 7);
  mem.write8(0x8057, regs.a);
  m.step(0x482b, 13);
  regs.a = 0x0a;
  m.step(0x482d, 7);
  mem.write8(0x8055, regs.a);
  m.step(0x4830, 13);
  regs.ix = 0x494f;
  m.step(0x4834, 14);
  m.push16(0x4837);
  m.step(0x3ddb, 17);
  m.call(0x3ddb);
  // BUG: tail-jump modelled as a returning call instead of `m.step; m.call`.
  m.push16(0x483a);
  m.step(0x3e01, 17);
  return m.call(0x3e01);
}

test("mutation (tail-jump modelled as a normal call) is caught by the full spec", () => {
  const bad = run(sub_4816_mutant);
  // Sanity: the mutant really does diverge.
  assert.equal(bad.cycles, 162, "mutant mischarges the jump (17 vs 10)");
  assert.notEqual(bad.pc, SENTINEL, "mutant does not land on the caller");
  assert.notEqual(bad.sp, SP0, "mutant leaves the caller's return orphaned");
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkAll(bad));
});
