// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_03bb (ROM 0x03bb-0x0475): the pchl-dispatch object handler. Record-only mock
// pins the rnc early-out, a mutation, the type-1 (doP) delegate arm, and the type-3 arm that walks the
// shared block T (0x0436) through doU/doV to ret.
//
// Run: node --test games/invaders/translated/test/loc_03bb.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_03bb } from "../loc_03bb.js";

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
    io: { inte: false, outs: [], setInte(on) { this.inte = !!on; }, portOut(p, v) { this.outs.push([p, v & 0xff]); } },
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

// The record-only mock does not balance the call to loc_1a06, so `pop h` recovers 0x03c1 (the addr our
// own `call` pushed). Carry from loc_1a06 is seated directly since the mock does not run the callee.
test("loc_03bb: loc_1a06 clears carry -> rnc early return; 48 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(0x4321);        // return address for the rnc
  m.regs.fC = false;       // loc_1a06 result: no carry -> rnc taken
  loc_03bb(m);
  assert.equal(m.tstates, 10 + 17 + 10 + 11, "lxi+call+pop+rnc(taken) = 48");
  assert.equal(m.regs.de, 0x202a, "DE := 0x202a");
  assert.deepEqual(m.calls, [0x1a06], "only the leading call ran");
  assert.equal(m.pc, 0x4321, "rnc returns to the seeded address");
});

test("loc_03bb MUTATION: lxi d mis-charged 7T not 10T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.push16(0x4321);
  m.regs.fC = false;
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x03be ? 7 : c);
  loc_03bb(m);
  assert.notEqual(m.tstates, 48, "golden T total catches the mutant");
  assert.equal(m.tstates, 45, "mutation loses 3 T (10 -> 7)");
});

// Type-1 record: carry set (rnc falls through), [ptr+1] == 1 -> doP edits 0x202a and delegates 0x1400.
test("loc_03bb: type 1 -> doP -> delegate loc_1400", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.fC = true;        // rnc not taken
  m.ram[0x03c2] = 0x01;    // [ptr+1] type byte == 1
  m.ram[0x201b] = 0x10;
  loc_03bb(m);
  assert.deepEqual(m.calls, [0x1a06, 0x0430, 0x1400], "leading call, doP's 0x0430, then delegate");
  assert.equal(m.ram[0x03c2], 0x02, "mov m,a wrote A after inr a");
  assert.equal(m.ram[0x202a], 0x18, "sta 0x202a <- 0x10 + 8");
  assert.equal(m.pc, 0x1400, "delegates to loc_1400");
});

// Type-3 record: [ptr+2] decrements to 0 (jz 0x0436) -> doT -> jc into doU -> jnz into doV -> ret.
test("loc_03bb: type 3 -> shared block T -> doU/doV -> ret", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.fC = true;        // rnc not taken
  m.ram[0x03c2] = 0x03;    // type byte == 3
  m.ram[0x03c3] = 0x01;    // dcr m -> 0 -> jz 0x0436
  m.mem.write16(0x208d, 0x0000);  // lhld -> 0; inr l -> 1; cpi 0x63 -> carry -> jc doU
  m.mem.write16(0x208f, 0x0000);
  m.ram[0x2084] = 0x00;    // ana a -> Z -> rnz not taken
  m.ram[0x0001] = 0x01;    // mov a,m; ani 0x01 -> NZ -> jnz doV (BC stays 0x0229)
  loc_03bb(m);
  assert.deepEqual(m.calls, [0x1a06, 0x0430, 0x1452, 0x1a32], "spine + doT's three sub-calls");
  assert.equal(m.regs.bc, 0x0229, "the jnz arm kept BC = 0x0229");
  assert.equal(m.ram[0x03c3], 0x00, "dcr m left 0");
  assert.equal(m.ram[0x208d], 0x01, "shld 0x208d wrote the incremented low byte");
  assert.equal(m.ram[0x208f], 0x01, "shld 0x208f wrote the incremented low byte");
  assert.equal(m.ram[0x208a], 0x29, "mov m,c wrote C");
  assert.equal(m.ram[0x208c], 0x02, "mov m,b wrote B (doV ran to its ret)");
});
