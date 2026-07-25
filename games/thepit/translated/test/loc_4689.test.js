// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated loc_4689 (ROM 0x4689-0x46A1), The Pit.
//
// Runs the routine on a lightweight machine built from the REAL thepit address
// space (boards/thepit/memory.js) + Io + the shared Z80 Regs. The two control-flow
// exits are exercised:
//   - skip path  ((0x8001)-1 >= 2): `jr nc,0x4672` -> bare ret -> return to caller,
//     score at 0x8031/0x8034 left UNTOUCHED.
//   - add path   ((0x8001) in {1,2}): BCD add of BC into 0x8031(low)/0x8034(high)
//     with DAA carry propagation, then tail-jump (m.call) to loc_46af.
// loc_46af is stubbed as a "pop-and-return" callee (balances the stack, adds no
// cycles) so the asserted T-state total is loc_4689's OWN instruction cost.
// A deliberate MUTATION (branch polarity flipped) is asserted to be caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4689 } from "../loc_4689.js";

const SENTINEL = 0xbeef; // caller return address that both exits must land on

// -- minimal machine: real mem/io/regs + the step/call/ret seam --------------
class TestMachine {
  constructor() {
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x4689;
    this.calls = [];
    this.regs.sp = 0x8780; // inside work RAM (0x8000-0x87ff) so pushes are mapped
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
  // Stubbed callee (tail-jump target): record it, then behave as a bare `ret`
  // (pop the address on the stack) so the stack stays balanced and PC lands on
  // the caller. No cycle charge -- loc_46af's own cost is not loc_4689's.
  call(addr) {
    this.calls.push(addr);
    this.pc = this.pop16();
    return undefined;
  }
  ret(cycles = 10) {
    this.step(this.pop16(), cycles);
  }
}

// state8001: value of the gate byte at 0x8001; bc/lo/hi seed the score add.
function run(fn, { state8001, lo = 0, hi = 0, b = 0, c = 0 }) {
  const m = new TestMachine();
  m.mem.write8(0x8001, state8001);
  m.mem.write8(0x8031, lo);
  m.mem.write8(0x8034, hi);
  m.regs.b = b;
  m.regs.c = c;
  m.push16(SENTINEL); // caller's return address
  fn(m);
  return {
    cycles: m.cycles,
    pc: m.pc,
    sp: m.regs.sp,
    calls: m.calls,
    lo: m.mem.read8(0x8031),
    hi: m.mem.read8(0x8034),
    a: m.regs.a,
  };
}

// -- SKIP path: (0x8001)=5 -> dec=4 -> cp 2 clears carry -> jr nc taken -------
//   own cost = ld(13)+dec(4)+cp(7)+jr-taken(12)+ret(10) = 46 T.
function checkSkip(res) {
  assert.equal(res.cycles, 46, "skip-path T-state total");
  assert.equal(res.pc, SENTINEL, "skip path returns to caller");
  assert.equal(res.sp, 0x8780, "stack balanced on skip");
  assert.deepEqual(res.calls, [], "skip path makes no tail-jump");
  assert.equal(res.lo, 0x40, "0x8031 untouched on skip");
  assert.equal(res.hi, 0x17, "0x8034 untouched on skip");
}

test("loc_4689: skip path ((0x8001)-1 >= 2) returns without touching the score", () => {
  checkSkip(run(loc_4689, { state8001: 5, lo: 0x40, hi: 0x17 }));
});

// gate byte 3 -> dec=2 -> cp 2 == 0, still NO borrow -> NC -> skip (boundary).
test("loc_4689: gate byte 3 is the skip boundary (cp 0x02 == 0 => NC)", () => {
  const res = run(loc_4689, { state8001: 3, lo: 0x11, hi: 0x22 });
  assert.equal(res.cycles, 46);
  assert.equal(res.lo, 0x11);
  assert.equal(res.hi, 0x22);
  assert.deepEqual(res.calls, []);
});

// -- ADD path: (0x8001)=1 -> dec=0 -> cp 2 borrows -> carry set -> fall through
//   BCD: 0995 + 0008 = 1003. lo 0x95 + C(0x08) = 0x9d -daa-> 0x03 carry;
//   hi 0x09 + B(0x00) + carry = 0x0a -daa-> 0x10.
//   own cost = ld(13)+dec(4)+cp(7)+jr-nt(7)+ld(13)+add(4)+daa(4)+ld(13)
//            +ld(13)+adc(4)+daa(4)+ld(13)+jr(12) = 111 T.
function checkAdd(res) {
  assert.equal(res.cycles, 111, "add-path T-state total");
  assert.equal(res.pc, SENTINEL, "tail-jump ret lands on caller");
  assert.equal(res.sp, 0x8780, "stack balanced through the tail-jump");
  assert.deepEqual(res.calls, [0x46af], "tail-jumps into loc_46af");
  assert.equal(res.lo, 0x03, "0x8031 = BCD low after 0995+8");
  assert.equal(res.hi, 0x10, "0x8034 = BCD high after carry propagates");
}

test("loc_4689: add path carries BCD across bytes (0995 + 8 = 1003)", () => {
  checkAdd(run(loc_4689, { state8001: 1, lo: 0x95, hi: 0x09, b: 0x00, c: 0x08 }));
});

// gate byte 2 -> dec=1 -> cp 2 borrows -> also the add path (no carry case).
test("loc_4689: gate byte 2 also adds; simple BCD 25 + 5 = 30", () => {
  const res = run(loc_4689, { state8001: 2, lo: 0x25, hi: 0x01, b: 0x00, c: 0x05 });
  assert.equal(res.cycles, 111);
  assert.equal(res.lo, 0x30, "0x8031 = 30 BCD");
  assert.equal(res.hi, 0x01, "0x8034 unchanged (no carry)");
  assert.deepEqual(res.calls, [0x46af]);
});

// -- MUTATION: branch polarity flipped (fC instead of fNC). On the SKIP input
// (gate byte 5) the mutant wrongly falls through, mutates the score, mischarges
// the branch, and tail-jumps to loc_46af. The skip spec MUST reject it.
function loc_4689_mutant(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8001);
  m.step(0x468c, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x468d, 4);
  regs.cp(0x02);
  m.step(0x468f, 7);
  if (regs.fC) { // BUG: should be fNC
    m.step(0x4672, 12);
    m.ret();
    return;
  }
  m.step(0x4691, 7);
  regs.a = mem.read8(0x8031);
  m.step(0x4694, 13);
  regs.add(regs.c);
  m.step(0x4695, 4);
  regs.daa();
  m.step(0x4696, 4);
  mem.write8(0x8031, regs.a);
  m.step(0x4699, 13);
  regs.a = mem.read8(0x8034);
  m.step(0x469c, 13);
  regs.adc(regs.b);
  m.step(0x469d, 4);
  regs.daa();
  m.step(0x469e, 4);
  mem.write8(0x8034, regs.a);
  m.step(0x46a1, 13);
  m.step(0x46af, 12);
  return m.call(0x46af);
}

test("mutation (branch polarity flipped) is caught by the skip spec", () => {
  // Sanity: the mutant really does diverge on the skip input.
  const bad = run(loc_4689_mutant, { state8001: 5, lo: 0x40, hi: 0x17 });
  assert.equal(bad.cycles, 111); // mischarged: took the add path
  assert.deepEqual(bad.calls, [0x46af]); // and tail-jumped
  // The spec the real routine passes must REJECT the mutant.
  assert.throws(() => checkSkip(bad));
});
