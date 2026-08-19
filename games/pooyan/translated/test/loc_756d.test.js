// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_756d (ROM 0x756d-0x7594): the arrow/projectile spawner driver.
// The mid-loop `call 0x7595` is stubbed on the boolean protocol: true = slot occupied (loop
// continues, callee's ret balances the pushed return), false = a launch/caller-skip that aborts
// the loop. loc_756d is exercised in isolation.
//
// Run: node --test games/pooyan/translated/test/loc_756d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_756d } from "../loc_756d.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

function installBalancingCalls(m) {
  m.call = (addr) => {
    m.calls.push(addr);
    m.regs.sp = (m.regs.sp + 2) & 0xffff; // slot occupied: callee's ret balances the pushed return
    return true; // 0x7595 returned normally -> loc_756d keeps walking records
  };
}

test("loc_756d: frame delay still counting -> dec (0x8929), ret; 49 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8929, 0x05);

  loc_756d(m);

  assert.equal(m.tstates, 49, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "no spawn work when still delaying");
  assert.equal(m.mem.read8(0x8929), 0x04, "delay decremented");
  assert.deepEqual(m.pcSeq, [0x7570, 0x7571, 0x7572, 0x7574, 0x7575, CALLER_RET], "step boundaries");
});

test("loc_756d: delay elapsed but all 8 waves spawned (0x892d==8) -> ret z; 64 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x08);

  loc_756d(m);

  assert.equal(m.tstates, 64, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.deepEqual(m.calls, [], "no records walked");
  assert.deepEqual(m.pcSeq, [0x7570, 0x7571, 0x7572, 0x7576, 0x7579, 0x757b, CALLER_RET], "step boundaries");
});

test("loc_756d: delay elapsed, all 8 slots occupied -> walk all 8 records; 652 T", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m); // every 0x7595 returns true (occupied) -> full walk
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x03); // not 8 -> loop runs

  loc_756d(m);

  assert.equal(m.tstates, 652, "T total");
  assert.equal(m.pc, CALLER_RET, "returns via ret after the loop");
  assert.equal(m.regs.sp, 0x8780, "8 call pushes balanced, ret popped the caller");
  assert.deepEqual(m.calls, Array(8).fill(0x7595), "loc_7595 called once per record");
  assert.equal(m.pcSeq.filter((p) => p === 0x7595).length, 8, "8 call-steps into 0x7595");
  assert.equal(m.regs.ix, (0x8ae0 + 8 * 0x18) & 0xffff, "IX advanced by 8 strides");
  assert.equal(m.regs.iy, (0x8b70 + 8 * 0x18) & 0xffff, "IY advanced by 8 strides");
});

test("loc_756d: a record launches (0x7595 caller-skips) -> loop aborts after ONE walk", () => {
  const m = makeMachine();
  seatCaller(m);
  // model loc_7595's caller-skip on the first record: pop af discards the pushed in-loop
  // return, then ret carries control to loc_756d's OWN caller. Returns false.
  m.call = (addr) => {
    m.calls.push(addr);
    m.regs.sp = (m.regs.sp + 2) & 0xffff; // pop af
    m.ret(); // ret to loc_756d's caller (CALLER_RET)
    return false;
  };
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x03);

  loc_756d(m);

  assert.equal(m.pc, CALLER_RET, "aborted to caller after the single launch");
  assert.deepEqual(m.calls, [0x7595], "only ONE record walked before the caller-skip");
  assert.equal(m.regs.ix, 0x8ae0, "IX NOT advanced -- loop aborted before add ix,de");
  assert.equal(m.regs.sp, 0x8780, "stack balanced: pop af + ret consumed both frames");
});

test("loc_756d MUTATION: `add ix,de` at 0x7590 mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  installBalancingCalls(m);
  m.mem.write8(0x8929, 0x00);
  m.mem.write8(0x892d, 0x03);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7590 ? 11 : c);

  loc_756d(m);

  assert.equal(m.tstates, 652 - 8 * 4, "mutation loses 4 T x 8 iterations (15 -> 11)");
  assert.notEqual(m.tstates, 652, "golden T-state total catches the mutant");
});
