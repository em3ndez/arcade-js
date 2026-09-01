// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_15d3 (ROM 0x15d3-0x15f2): call setup 0x1474, then loop B rows -- each row
// shift-register-decodes (DE) -> (HL) and 0 -> (HL+1) through ports 0x04 (out) / 0x03 (in), advancing
// DE by 1 and HL by 0x20 -- then restore HL and ret. The mock's call is record-only, so the internal
// `call 0x1474` leaves its pushed return (0x15d6) on the stack and the routine's ret pops THAT --
// final PC = 0x15d6 (documented artifact). io records portOut and feeds portIn from a queue.
//
// Run: node --test games/invaders/translated/test/loc_15d3.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_15d3 } from "../loc_15d3.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  const m = {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x15d3, pcSeq: [],
    outLog: [], inLog: [], inQueue: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
  m.io = {
    portOut: (port, val) => { m.outLog.push([port, val]); },
    portIn: (port) => { m.inLog.push(port); return m.inQueue.length ? m.inQueue.shift() : 0; },
  };
  return m;
}

test("loc_15d3: decodes 2 rows via ports 0x04/0x03, restores HL, rets; 352 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2400;          // dest pointer (record-only 0x1474 does not set it)
  m.regs.de = 0x3000;          // source pointer
  m.regs.b = 0x02;             // 2 rows
  m.regs.c = 0x00;
  m.mem.write8(0x3000, 0xab);  // row0 source byte -> out 0x04
  m.mem.write8(0x3001, 0xcd);  // row1 source byte -> out 0x04
  m.inQueue = [0x11, 0x22, 0x33, 0x44]; // in 0x03 results, in order

  loc_15d3(m);

  assert.equal(m.mem.read8(0x2400), 0x11, "row0: decoded byte at HL");
  assert.equal(m.mem.read8(0x2401), 0x22, "row0: zero-shift byte at HL+1");
  assert.equal(m.mem.read8(0x2420), 0x33, "row1: decoded byte at HL+0x20");
  assert.equal(m.mem.read8(0x2421), 0x44, "row1: zero-shift byte at HL+0x21");
  assert.deepEqual(
    m.outLog,
    [[0x04, 0xab], [0x04, 0x00], [0x04, 0xcd], [0x04, 0x00]],
    "out 0x04: (DE) then 0 per row",
  );
  assert.deepEqual(m.inLog, [0x03, 0x03, 0x03, 0x03], "four in 0x03 reads");
  assert.equal(m.regs.a, 0x44, "A = last in 0x03 result");
  assert.equal(m.regs.hl, 0x2400, "HL restored to entry by the outer pop h");
  assert.equal(m.regs.de, 0x3002, "DE advanced by 1 per row");
  assert.equal(m.regs.bc, 0x0000, "B counted down to 0 (C untouched)");
  assert.equal(m.tstates, 17 + 11 + 2 * 152 + 10 + 10, "call+push h + 2 loop iters(152) + pop h + ret");
  assert.deepEqual(m.calls, [0x1474], "one internal setup call");
  assert.equal(m.pc, 0x15d6, "ARTIFACT: ret pops the internal call's return (0x15d6)");
  assert.equal(m.regs.sp, 0x2400, "SP balanced back to entry");
});

test("loc_15d3 MUTATION: dad b mis-charged 11T (not 10T) over both rows is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2400; m.regs.de = 0x3000; m.regs.b = 0x02; m.regs.c = 0x00;
  m.inQueue = [0x11, 0x22, 0x33, 0x44];
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x15ec ? 11 : c); // 0x15ec = landing after dad b
  loc_15d3(m);
  assert.equal(m.tstates, 354, "dad b +1T across two iterations -> 352 + 2");
  assert.notEqual(m.tstates, 352, "golden T-state total catches the mutant");
});
