// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for the translated sub_467b (ROM 0x467b-0x4682), The Pit.
//
// sub_467b is a thin score-add entry: fire sound effect 0x10, preload the BCD
// increment BC=0x0010, then TAIL-jump into the shared adder sub_4689. Runs on a
// lightweight machine built from the REAL thepit address space + Io + the shared
// Z80 Regs over a zeroed fake ROM (the copyrighted image is never committed; this
// routine's own instructions touch only registers and the stack). Both callees —
// the real `call 0x4c8f` and the tail-jump `jr 0x4689` — are stubbed as a bare
// "pop-and-return" that balances the stack and adds no cycles, so the asserted
// T-state total is sub_467b's OWN instruction cost:
//   17 (call) + 10 (ld bc,nn) + 12 (jr) = 39 T.
//
// The load-bearing decision is the terminal `jr 0x4689`: it is a TAIL-JUMP (a JR
// pushes nothing), so sub_4689's own `ret` returns to sub_467b's caller, and the
// stack must stay balanced with a SINGLE net ret. The spec asserts pc lands on
// OUR caller and sp is restored; MUTATION 3 flips the model to the wrong
// `m.call(); m.ret()` shape and shows the double-pop corrupts both.
//
// sub_467b's own three instructions (CALL / LD BC,nn / JR) touch NO flag and do
// not write A, so a sentinel F and A are seeded and asserted UNCHANGED.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_467b } from "../sub_467b.js";

const SENTINEL = 0xbeef; // caller's return address; the tail-jump's ret must land here
const SP0 = 0x8780; // initial SP (inside work RAM so pushes are mapped)
const F_SENTINEL = 0xa5; // seeded into F; the routine sets no flags, so it must survive
const A_SENTINEL = 0x3c; // seeded into A; the routine never writes A (the callee would)

// -- expected results of the correct run ------------------------------------
const EXP_CYCLES = 17 + 10 + 12; // 39
const EXP_BC = 0x0010; // BCD score increment (+10)
const EXP_CALLS = [0x4c8f, 0x4689]; // sound-effect call, then tail-jump into the adder

// -- minimal machine: real mem/io/regs + the step/call seam -----------------
class TestMachine {
  constructor(rom) {
    this.io = new Io();
    this.mem = new AddressSpace(rom, this.io);
    this.regs = new Regs();
    this.cycles = 0;
    this.pc = 0x467b;
    this.calls = [];
    this.regs.sp = SP0;
    this.regs.f = F_SENTINEL;
    this.regs.a = A_SENTINEL;
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
  // Stubbed callee: record it, then behave as a bare `ret` (pop whatever the
  // preceding push/JR left on the stack). For the mid `call 0x4c8f` that is the
  // return address just pushed (0x467e); for the tail JR it is OUR caller's
  // return. No cycle charge -- a callee's cost is not sub_467b's.
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
  m.push16(SENTINEL); // caller's return address (consumed by the tail-jump's ret)
  fn(m);
  return {
    cycles: m.cycles,
    bc: m.regs.bc,
    a: m.regs.a,
    f: m.regs.f,
    pc: m.pc,
    sp: m.regs.sp,
    calls: m.calls,
  };
}

// Full spec, factored so each mutant runs through the identical checks.
function checkSpec(res) {
  assert.equal(res.cycles, EXP_CYCLES, "T-state total (39 = sub_467b's own instructions)");
  assert.equal(res.bc, EXP_BC, "BC = 0x0010 (BCD score increment)");
  assert.equal(res.a, A_SENTINEL, "A untouched (the sound callee that sets A is stubbed)");
  assert.equal(res.f, F_SENTINEL, "flags untouched (CALL/LD BC,nn/JR set none)");
  assert.equal(res.pc, SENTINEL, "tail-jump callee ret lands on OUR caller");
  assert.equal(res.sp, SP0, "stack balanced -- exactly one net ret (jr pushed nothing)");
  assert.deepEqual(res.calls, EXP_CALLS, "calls 0x4c8f then tail-jumps 0x4689");
}

test("sub_467b: sound call + BC=0x0010 + tail-jump 0x4689; 39 T", () => {
  checkSpec(run(sub_467b));
});

// -- MUTATION 1 (SEMANTIC): `ld bc,0x0020` (the +20 sibling's increment) instead
// of `ld bc,0x0010`. Same cycle total, but BC ends 0x0020 -- only the register
// assert exposes it; a cycle-only diff would miss it.
function sub_467b_incMutant(m) {
  const { regs } = m;
  m.push16(0x467e);
  m.step(0x4c8f, 17);
  m.call(0x4c8f);
  regs.bc = 0x0020; // BUG: increment should be 0x0010, not 0x0020
  m.step(0x4681, 10);
  m.step(0x4689, 12);
  return m.call(0x4689);
}

test("mutation (BC=0x0020 not 0x0010) is caught by the register assert", () => {
  const bad = run(sub_467b_incMutant);
  assert.equal(bad.cycles, EXP_CYCLES, "cycles UNCHANGED -- a cycle-only diff misses this");
  assert.equal(bad.bc, 0x0020, "mutant loads the wrong increment");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});

// -- MUTATION 2 (CYCLE): charge the `jr 0x4689` 10 T (a JP's cost) instead of 12.
// A JR is 12 T, not 10 -- an easy slip when copying from a `jp` tail-jump. Moves
// no memory and leaves every register identical; only the T-state total exposes it.
function sub_467b_cycleMutant(m) {
  const { regs } = m;
  m.push16(0x467e);
  m.step(0x4c8f, 17);
  m.call(0x4c8f);
  regs.bc = 0x0010;
  m.step(0x4681, 10);
  m.step(0x4689, 10); // BUG: jr is 12 T, not 10 (that is a jp's cost)
  return m.call(0x4689);
}

test("mutation (jr mischarged 10 T not 12) is caught by the cycle assertion", () => {
  const bad = run(sub_467b_cycleMutant);
  assert.equal(bad.bc, EXP_BC, "register identical -- a state-only diff would miss this");
  assert.equal(bad.cycles, EXP_CYCLES - 2, "mutant is exactly 2 T short");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});

// -- MUTATION 3 (CONTROL-FLOW): model the terminal `jr 0x4689` with the WRONG
// `m.call(); m.ret()` shape. The tail-jump pushed nothing, so sub_4689's ret
// already returned to our caller; the extra m.ret() pops a SECOND word -- pc lands
// on the garbage below the sentinel and sp is left two bytes high. This is the
// double-pop trap the header warns against, and only the pc/sp asserts pin it down.
function sub_467b_doubleRetMutant(m) {
  const { regs } = m;
  m.push16(0x467e);
  m.step(0x4c8f, 17);
  m.call(0x4c8f);
  regs.bc = 0x0010;
  m.step(0x4681, 10);
  m.step(0x4689, 12);
  m.call(0x4689);
  m.ret(); // BUG: the `m.call(); m.ret()` shape -- a spurious second pop
}

test("mutation (tail-jump written as m.call+m.ret, a double-pop) is caught by pc/sp", () => {
  const bad = run(sub_467b_doubleRetMutant);
  assert.notEqual(bad.pc, SENTINEL, "pc no longer lands on our caller (popped a second word)");
  assert.notEqual(bad.sp, SP0, "stack left unbalanced by the spurious ret");
  assert.throws(() => checkSpec(bad), "the spec the real routine passes rejects the mutant");
});
