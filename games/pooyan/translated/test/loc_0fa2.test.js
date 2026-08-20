// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0fa2 (ROM 0x0fa2, Pooyan): A = ((0x8907) rrca & 3) + 0x22 (one of
// 0x22..0x25) then a tail-`jp 0x0fc3` into the 4-tile emitter. Flat-RAM mock with a real stack;
// the mock's `call` POPS (models the tail callee's ret consuming the seated CALLER_RET), so the
// stack fully unwinds to the pre-seat baseline. Straight-line (no branches); two input cases
// exercise the rrca/and/add arithmetic. T = 13 + 4 + 7 + 7 + 10 = 41.
// Run: node --test games/pooyan/translated/test/loc_0fa2.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0fa2 } from "../loc_0fa2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0fa2, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PC_SEQ = [0x0fa5, 0x0fa6, 0x0fa8, 0x0faa, 0x0fc3];

test("loc_0fa2: (0x8907)=0x05 -> A=0x24, tail into loc_0fc3", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x05); // rrca -> 0x82; &3 -> 0x02; +0x22 -> 0x24

  loc_0fa2(m);

  assert.equal(m.regs.a, 0x24, "tile code 0x22 + 0x02");
  assert.equal(m.tstates, 41, "T = 13 + 4 + 7 + 7 + 10");
  assert.equal(m.pc, 0x0fc3, "tail lands at the emitter entry");
  assert.deepEqual(m.calls, [0x0fc3], "delegates to loc_0fc3");
  assert.deepEqual(m.pcSeq, PC_SEQ, "step boundaries match the disassembly");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (tail callee ret pops CALLER_RET)");
});

test("loc_0fa2: (0x8907)=0x06 -> A=0x25 (different low 2 bits)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x06); // rrca -> 0x03; &3 -> 0x03; +0x22 -> 0x25

  loc_0fa2(m);

  assert.equal(m.regs.a, 0x25, "tile code 0x22 + 0x03");
  assert.equal(m.tstates, 41, "same straight-line T total");
  assert.deepEqual(m.pcSeq, PC_SEQ, "same path");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_0fa2 MUTATION: `jp 0x0fc3` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8907, 0x05);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0fc3 ? 7 : c);

  loc_0fa2(m);

  assert.equal(m.tstates, 38, "mutation loses 3 T (10 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 41, "golden"), /41/, "golden T total catches the mutant");
});
