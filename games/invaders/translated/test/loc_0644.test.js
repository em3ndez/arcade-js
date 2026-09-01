// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0644 (ROM 0x0644-0x0669): decrement counter [0x2078] and branch on it.
// Three arms: (a) ==3 -> re-seed block + tail-jump loc_066c; (b) !=3 & !=0 -> rnz returns; (c) ==0
// -> tail-jump loc_0675. Pins mem writes, register file, T-states, m.calls, and the call return addr.
//
// Run: node --test games/invaders/translated/test/loc_0644.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0644 } from "../loc_0644.js";

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
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

test("loc_0644: [0x2078] hits 3 -> re-seed + tail-jump loc_066c; 172 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2078, 0x04); // dcr -> 0x03
  m.mem.write8(0x207c, 0x10);
  m.mem.write8(0x207b, 0x20);

  loc_0644(m);

  assert.equal(m.mem.read8(0x2078), 0x03, "counter decremented to 3");
  assert.equal(m.mem.read8(0x2079), 0xdc, "shld 0x1cdc low byte");
  assert.equal(m.mem.read8(0x207a), 0x1c, "shld 0x1cdc high byte");
  assert.equal(m.mem.read8(0x207c), 0x0e, "0x207c decremented twice (0x10 -> 0x0e)");
  assert.equal(m.mem.read8(0x207b), 0x1e, "0x207b decremented twice (0x20 -> 0x1e)");
  assert.equal(m.mem.read8(0x207d), 0x06, "0x207d := 0x06");
  assert.equal(m.regs.a, 0x06, "a := 0x06");
  assert.equal(m.regs.hl, 0x207b, "hl after lxi 0x207c then dcx");
  assert.equal(m.tstates, 172, "T total, Z arm");
  assert.deepEqual(m.calls, [0x0675, 0x066c], "call 0x0675 then tail-jump loc_066c");
  assert.equal(m.mem.read16(0x23fe), 0x0651, "call 0x0675 pushes return addr 0x0651");
  assert.equal(m.pc, 0x066c, "last step lands at the loc_066c delegate");
});

test("loc_0644: counter != 3 and != 0 -> rnz returns; 59 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.mem.write8(0x2078, 0x05); // dcr -> 0x04, != 3, != 0

  loc_0644(m);

  assert.equal(m.mem.read8(0x2078), 0x04, "counter decremented to 4");
  assert.equal(m.tstates, 59, "T: lxi+dcrm+mov+cpi+jnz(taken)+ana+rnz(taken)");
  assert.deepEqual(m.calls, [], "no delegate -- rnz returns");
  assert.equal(m.pc, CALLER_RET, "rnz returns to the seated caller");
});

test("loc_0644: counter reaches 0 -> tail-jump loc_0675; 63 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2078, 0x01); // dcr -> 0x00

  loc_0644(m);

  assert.equal(m.mem.read8(0x2078), 0x00, "counter decremented to 0");
  assert.equal(m.tstates, 63, "T: ...+jnz(taken)+ana+rnz(not taken)+jmp");
  assert.deepEqual(m.calls, [0x0675], "tail-jumps loc_0675");
  assert.equal(m.pc, 0x0675, "last step lands at the loc_0675 delegate");
});

test("loc_0644 MUTATION: `shld 0x2079` mis-charged 13T (not 16T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x2078, 0x04);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0657 ? 13 : c);
  loc_0644(m);
  assert.equal(m.tstates, 169, "mutation loses 3 T (16 -> 13)");
  assert.notEqual(m.tstates, 172, "golden T-state total catches the mutant");
});
