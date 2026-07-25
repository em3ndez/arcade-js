// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for sub_319d (ROM 0x319D-0x33B9) -- the per-object move/collision
// driver. Asserts the T-state total and the routine's key register/memory/
// control-flow effects against the disassembly on THREE paths (the fast
// column-match exit, the state-0 countdown ret, and the deep VRAM-pointer
// decode), plus a deliberate one-instruction MUTATION the invariant must catch.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { sub_319d } from "../sub_319d.js";

// Minimal faithful stand-in for the machine: real Regs/AddressSpace/Io, and
// step/call/ret/push16 modelled exactly like the DK Machine. call() RECORDS the
// target (the sub_33xx probes / movement handlers have no thepit translation
// yet), so the tested paths are chosen NOT to branch on a callee's return flags.
class MockMachine {
  constructor() {
    this.regs = new Regs();
    this.io = new Io();
    this.mem = new AddressSpace(new Uint8Array(0x5000), this.io);
    this.regs.sp = 0x8780; // stack inside work RAM so push16 lands in mapped RAM
    this.cycles = 0;
    this.pc = 0x319d;
    this.calls = [];
    this.returned = false;
  }
  step(nextAddr, cycles) { this.pc = nextAddr; this.cycles += cycles; }
  call(addr) { this.calls.push(addr); return undefined; }
  ret(cycles = 10) { this.cycles += cycles; this.returned = true; }
  push16(value) {
    this.regs.sp = (this.regs.sp - 2) & 0xffff;
    this.mem.write8(this.regs.sp, value & 0xff);
    this.mem.write8((this.regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
  }
}

// ---- PATH 1: fast exit -----------------------------------------------------
// (0x807a) == (0x8093) -> `cp b` Z -> jp z,0x3458 taken as the very first branch.
test("sub_319d fast path: matched target column tail-jumps to 0x3458", () => {
  const m = new MockMachine();
  m.mem.write8(0x8093, 0x04);
  m.mem.write8(0x807a, 0x04);
  sub_319d(m);
  assert.equal(m.cycles, 44, "T: ld/ld/ld/cp b + jp z taken = 13+4+13+4+10");
  assert.deepEqual(m.calls, [0x3458], "tail-jump into 0x3458 via m.call");
  assert.equal(m.returned, false, "left via tail-jump, not a ret");
});

// ---- PATH 2: state-0 countdown ret -----------------------------------------
// (0x8090)==0 (state idle), so decrement the 0x808b timer; it stays non-zero
// -> `ret nz`. Nothing else is touched.
test("sub_319d countdown path: decrements 0x808b and returns via ret nz", () => {
  const m = new MockMachine();
  m.mem.write8(0x8093, 0x02);
  m.mem.write8(0x807a, 0x00); // != 0x8093 -> skip the fast exit
  m.mem.write8(0x8090, 0x00); // state 0 -> jp m / jr nz both fall through
  m.mem.write8(0x808b, 0x05); // timer -> 0x04, still non-zero -> ret nz
  sub_319d(m);
  assert.equal(m.cycles, 119, "T-state total for the ret-nz path");
  assert.equal(m.mem.read8(0x808b), 0x04, "timer decremented 0x05 -> 0x04");
  assert.equal(m.mem.read8(0x8090), 0x00, "state byte untouched (timer not expired)");
  assert.deepEqual(m.calls, [], "no call/tail-jump on the countdown path");
  assert.equal(m.returned, true, "returned via ret nz");
});

// ---- PATH 3: deep VRAM-pointer decode --------------------------------------
// Inputs steer entry -> loc_31d0 -> loc_3203 -> loc_3258 -> loc_3277 -> loc_3289
// (the position decoder), then loc_32f2's `and 0x07` is non-zero -> jp nz,0x347d.
// This exercises the whole srl/rr/neg/add-hl address maths.
function setupDeep(m) {
  m.mem.write8(0x8093, 0x01); // target column (!= 0x807a, != 0x05, != 0x04)
  m.mem.write8(0x807a, 0x00); // current column 0
  m.mem.write8(0x8090, 0x01); // state positive-nonzero -> jr nz,0x31d0
  m.mem.write8(0x80a1, 0x00); // -> jr z,0x3203 (skip player-box test)
  m.mem.write8(0x80c1, 0x00); // second-box guard clear
  m.mem.write8(0x8083, 0x80); // object Y
  m.mem.write8(0x8068, 0x00); // -> jr c,0x3258 (box miss)
  m.mem.write8(0x8086, 0x20); // object X (!= 0x23 top row, != 0xdc)
  m.mem.write8(0x8092, 0x01); // direction 1 -> dec z -> loc_32f2
}
function checkDeep(m) {
  assert.equal(m.cycles, 629, "T-state total for the deep decode path");
  assert.equal(m.mem.read16(0x8089), 0x91e4, "VRAM tile pointer = 0x91E4");
  assert.equal(m.mem.read8(0x808d), 0xa0, "sub-tile phase byte = 0xA0");
  assert.equal(m.regs.a, 0x04, "A = (0x8083+4)&7 = 0x04 at the loc_32f2 branch");
  assert.deepEqual(m.calls, [0x347d], "loc_32f2 tail-jumps to 0x347d");
  assert.equal(m.returned, false, "left via tail-jump, not a ret");
}
test("sub_319d deep path: decodes 0x8089/0x808d then tail-jumps to 0x347d", () => {
  const m = new MockMachine();
  setupDeep(m);
  sub_319d(m);
  checkDeep(m);
});

// ---- MUTATION --------------------------------------------------------------
// A faithful straight-line reproduction of the EXACT instruction stream the deep
// path executes, with ONE deliberate break: `add a,0x1f` at 0x3296 replaced by
// `add a,0x1e`. That shifts the tile ROW term, so the VRAM pointer at 0x8089
// comes out 0x91C4 instead of 0x91E4 -- while cycles (629) and 0x808d (0xA0) are
// unchanged. checkDeep must reject it purely on the memory invariant, proving
// the 0x8089 assertion has teeth (a timing-blind, compensating-error-shaped bug).
function sub_319d_MUTANT_deep(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8093); m.step(0x31a0, 13);
  regs.b = regs.a; m.step(0x31a1, 4);
  regs.a = mem.read8(0x807a); m.step(0x31a4, 13);
  regs.cp(regs.b); m.step(0x31a5, 4);
  m.step(0x31a8, 10); // jp z NOT taken
  regs.a = mem.read8(0x8090); m.step(0x31ab, 13);
  regs.or(regs.a); m.step(0x31ac, 4);
  m.step(0x31af, 10); // jp m NOT taken
  m.step(0x31d0, 12); // jr nz,0x31d0 taken
  // loc_31d0
  regs.a = mem.read8(0x80a1); m.step(0x31d3, 13);
  regs.or(regs.a); m.step(0x31d4, 4);
  m.step(0x3203, 12); // jr z,0x3203 taken
  // loc_3203
  regs.a = mem.read8(0x807a); m.step(0x3206, 13);
  regs.or(regs.a); m.step(0x3207, 4);
  m.step(0x3209, 7); // jr nz NOT taken
  regs.a = mem.read8(0x80c1); m.step(0x320c, 13);
  regs.or(regs.a); m.step(0x320d, 4);
  m.step(0x320f, 7); // jr nz NOT taken
  regs.a = mem.read8(0x8083); m.step(0x3212, 13);
  regs.h = regs.a; m.step(0x3213, 4);
  regs.a = mem.read8(0x8068); m.step(0x3216, 13);
  regs.add(0x08); m.step(0x3218, 7);
  regs.cp(regs.h); m.step(0x3219, 4);
  m.step(0x3258, 12); // jr c,0x3258 taken
  // loc_3258
  regs.a = mem.read8(0x8086); m.step(0x325b, 13);
  regs.cp(0x23); m.step(0x325d, 7);
  m.step(0x3277, 12); // jr nz,0x3277 taken
  // loc_3277
  regs.a = mem.read8(0x8083); m.step(0x327a, 13);
  regs.cp(0xdc); m.step(0x327c, 7);
  m.step(0x3289, 12); // jr nz,0x3289 taken
  // loc_3289
  regs.a = mem.read8(0x8083); m.step(0x328c, 13);
  regs.add(0x04); m.step(0x328e, 7);
  regs.a = regs.srl(regs.a); m.step(0x3290, 8);
  regs.a = regs.srl(regs.a); m.step(0x3292, 8);
  regs.a = regs.srl(regs.a); m.step(0x3294, 8);
  regs.neg(); m.step(0x3296, 8);
  regs.add(0x1e); m.step(0x3298, 7); // <-- MUTATION: add a,0x1e for add a,0x1f
  regs.h = regs.a; m.step(0x3299, 4);
  regs.a = mem.read8(0x8086); m.step(0x329c, 13);
  regs.add(0x05); m.step(0x329e, 7);
  regs.b = 0x00; m.step(0x32a0, 7);
  regs.a = regs.srl(regs.a); m.step(0x32a2, 8);
  regs.b = regs.rr(regs.b); m.step(0x32a4, 8);
  regs.a = regs.srl(regs.a); m.step(0x32a6, 8);
  regs.b = regs.rr(regs.b); m.step(0x32a8, 8);
  regs.a = regs.srl(regs.a); m.step(0x32aa, 8);
  regs.b = regs.rr(regs.b); m.step(0x32ac, 8);
  regs.c = regs.a; m.step(0x32ad, 4);
  regs.a = regs.b; m.step(0x32ae, 4);
  mem.write8(0x808d, regs.a); m.step(0x32b1, 13);
  regs.a = 0x00; m.step(0x32b3, 7);
  regs.b = regs.a; m.step(0x32b4, 4);
  regs.h = regs.srl(regs.h); m.step(0x32b6, 8);
  regs.rra(); m.step(0x32b7, 4);
  regs.h = regs.srl(regs.h); m.step(0x32b9, 8);
  regs.rra(); m.step(0x32ba, 4);
  regs.h = regs.srl(regs.h); m.step(0x32bc, 8);
  regs.rra(); m.step(0x32bd, 4);
  regs.l = regs.a; m.step(0x32be, 4);
  regs.addHl(regs.bc); m.step(0x32bf, 11);
  regs.bc = 0x9000; m.step(0x32c2, 10);
  regs.addHl(regs.bc); m.step(0x32c3, 11);
  mem.write16(0x8089, regs.hl); m.step(0x32c6, 16);
  regs.a = mem.read8(0x8093); m.step(0x32c9, 13);
  regs.cp(0x05); m.step(0x32cb, 7);
  m.step(0x32ce, 10); // jp z,0x3345 NOT taken
  regs.a = mem.read8(0x8092); m.step(0x32d1, 13);
  regs.a = regs.dec8(regs.a); m.step(0x32d2, 4);
  m.step(0x32f2, 10); // jp z,0x32f2 taken
  // loc_32f2
  regs.a = mem.read8(0x8083); m.step(0x32f5, 13);
  regs.add(0x04); m.step(0x32f7, 7);
  regs.and(0x07); m.step(0x32f9, 7);
  m.step(0x347d, 10); // jp nz,0x347d taken
  return m.call(0x347d);
}

test("MUTATION caught: `add a,0x1e` for `add a,0x1f` corrupts VRAM ptr 0x8089", () => {
  const good = new MockMachine();
  setupDeep(good);
  sub_319d(good);
  checkDeep(good); // sanity: the real routine passes its own invariants

  const bad = new MockMachine();
  setupDeep(bad);
  sub_319d_MUTANT_deep(bad);
  assert.equal(bad.mem.read16(0x8089), 0x91c4, "mutant yields 0x91C4, not 0x91E4");
  assert.equal(bad.cycles, 629, "timing is UNCHANGED -- the bug is memory-only");
  assert.throws(() => checkDeep(bad), "the invariant checker must reject the mutant");
});
