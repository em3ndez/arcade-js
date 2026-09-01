// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0b89 (ROM 0x0b89-0x0be7): round teardown / next-round setup, a
// second entry point into the loc_0aea flow. Two data-dependent branches key off 0x20ec (via
// cpi 0x00) and one off the OUT-2 input bit (in 0x02; rlc; jc). Both arm-sets are exercised:
//   - "else" path: 0x20ec==0 and input bit7==0 -> runs all three fall-through blocks.
//   - "taken" path: 0x20ec!=0 and input bit7==1 -> skips them.
// Pins the call/delegate sequence, push return addresses, register + memory writes, T-states.
//
// Run: node --test games/invaders/translated/test/loc_0b89.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0b89 } from "../loc_0b89.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const io = {
    outs: [], ins: [], inVals: {},
    portOut(p, v) { this.outs.push([p & 0x07, v & 0xff]); },
    portIn(p) { this.ins.push(p & 0x07); return this.inVals[p & 0x07] || 0; },
    setInte(on) { this.inte = !!on; },
  };
  return {
    regs, mem, ram, io, calls: [], pushes: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { this.pushes.push(v); regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_0b89 else-path: 0x20ec==0, input bit7==0 runs all three blocks; 425 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x20ec] = 0x00;
  m.io.inVals[2] = 0x00; // OUT-2 input, bit7 clear -> jc not taken

  loc_0b89(m);

  assert.equal(m.tstates, 425, "golden T total (all fall-through blocks run)");
  assert.deepEqual(
    m.calls,
    [0x0ab1, 0x1988, 0x08f3, 0x08ff, 0x1856, 0x184c, 0x183a, 0x0ab6, 0x0ae2, 0x0a80, 0x189e, 0x09d6, 0x18df],
    "full call sequence ending in the tail delegate to loc_18df",
  );
  assert.deepEqual(
    m.pushes,
    [0x0b90, 0x0b93, 0x0b9e, 0x0bae, 0x0bb4, 0x0bb7, 0x0bc3, 0x0bc6, 0x0bd4, 0x0bd7, 0x0bda, 0x0be5],
    "each call pushes its own return address",
  );
  assert.equal(m.regs.a, 0x01, "A := (0x20ec+1)&1 = 1");
  assert.equal(m.regs.hl, 0x20ec, "HL := 0x20ec");
  assert.equal(m.regs.bc, 0x1fa0, "BC := 0x1fa0 (second lxi b)");
  assert.equal(m.regs.de, 0x1fd5, "DE := 0x1fd5 (last lxi d)");
  assert.equal(m.ram[0x20c1], 0x00, "0x20c1 cleared");
  assert.equal(m.ram[0x20ec], 0x01, "0x20ec toggled to 1");
  assert.deepEqual(m.io.ins, [2], "reads OUT-2 input once");
  assert.equal(m.io.outs.length, 0, "no OUT writes");
  assert.equal(m.pc, 0x18df, "tail-delegates to loc_18df");
});

test("loc_0b89 taken-path: 0x20ec!=0, input bit7==1 skips all three blocks; 303 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x20ec] = 0x01;
  m.io.inVals[2] = 0x80; // bit7 set -> rlc carry=1 -> jc taken

  loc_0b89(m);

  assert.equal(m.tstates, 303, "golden T total (fall-through blocks skipped)");
  assert.deepEqual(
    m.calls,
    [0x0ab1, 0x1988, 0x08f3, 0x1856, 0x184c, 0x0ab6, 0x09d6, 0x18df],
    "short call sequence (branch arms taken)",
  );
  assert.deepEqual(
    m.pushes,
    [0x0b90, 0x0b93, 0x0b9e, 0x0bb4, 0x0bb7, 0x0bc6, 0x0be5],
    "push return addresses on the taken path",
  );
  assert.equal(m.regs.a, 0x00, "A := (1+1)&1 = 0");
  assert.equal(m.regs.bc, 0x1f9c, "BC := 0x1f9c (first lxi b, second skipped)");
  assert.equal(m.regs.de, 0x1f90, "DE := 0x1f90 (first lxi d, second skipped)");
  assert.equal(m.ram[0x20ec], 0x00, "0x20ec toggled to 0");
  assert.equal(m.pc, 0x18df, "tail-delegates to loc_18df");
});

test("loc_0b89 MUTATION: tail jmp mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.ram[0x20ec] = 0x00;
  m.io.inVals[2] = 0x00;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x18df ? 7 : c);
  loc_0b89(m);
  assert.notEqual(m.tstates, 425, "golden T-state total catches the mutant");
});
