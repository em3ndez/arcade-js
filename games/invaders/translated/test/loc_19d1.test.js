// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_19d1 (ROM 0x19d1-0x19d2): A:=1 then falls through into loc_19d3.
// Run: node --test games/invaders/translated/test/loc_19d1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_19d1 } from "../loc_19d1.js";

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

test("loc_19d1: A:=1, delegates to loc_19d3; 7 T", () => {
  const m = makeMachine();

  loc_19d1(m);

  assert.equal(m.regs.a, 0x01, "A := 0x01");
  assert.equal(m.tstates, 7, "T total: mvi(7)");
  assert.equal(m.pc, 0x19d3, "last step lands at loc_19d3 entry");
  assert.deepEqual(m.calls, [0x19d3], "falls through into loc_19d3");
  assert.deepEqual(m.pcSeq, [0x19d3], "single step boundary");
});

test("loc_19d1 MUTATION: `mvi a` flipped value is caught", () => {
  const m = makeMachine();
  loc_19d1(m);
  assert.equal(m.regs.a, 0x01, "control: golden A is 0x01");
  const m2 = makeMachine();
  m2.regs.a = 0x99;
  // If the routine forgot to load A, A would keep 0x99 -- the golden assertion would fire.
  loc_19d1(m2);
  assert.notEqual(m2.regs.a, 0x99, "A is overwritten to 0x01, not left stale");
});
