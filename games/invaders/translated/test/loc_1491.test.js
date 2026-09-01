// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1491 (ROM 0x1491-0x14ca): call setup 0x1474, clear collision flag 0x2061,
// then per row OR a shifted sprite into (HL)/(HL+1) with collision detect -- a non-zero AND overlap
// sets 0x2061=1. This scenario runs one row where column 0 collides (overlap) and column 1 does not,
// exercising BOTH jz arms. The mock's call is record-only, so the internal `call 0x1474` leaves its
// pushed return (0x1494) on the stack and the routine's ret pops THAT -- final PC = 0x1494 (artifact).
//
// Run: node --test games/invaders/translated/test/loc_1491.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1491 } from "../loc_1491.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1491, pcSeq: [],
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

test("loc_1491: draws one row (OR), col0 collides + col1 clear, sets 0x2061; 306 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2500;          // dest (record-only 0x1474 does not set it)
  m.regs.de = 0x3000;          // source pointer
  m.regs.b = 0x01;             // 1 row
  m.regs.c = 0x00;
  m.mem.write8(0x3000, 0x0f);  // (DE) -> out 0x04 for column 0
  m.mem.write8(0x2500, 0x08);  // field col0: overlaps the shifted byte -> collision
  m.mem.write8(0x2501, 0x03);  // field col1: no overlap with 0
  m.inQueue = [0xff, 0x00];    // in 0x03: col0 shifted byte 0xff, col1 shifted byte 0x00

  loc_1491(m);

  assert.equal(m.mem.read8(0x2061), 0x01, "collision flag set by column 0 overlap");
  assert.equal(m.mem.read8(0x2500), 0xff, "col0: 0xff | 0x08");
  assert.equal(m.mem.read8(0x2501), 0x03, "col1: 0x00 | 0x03");
  assert.deepEqual(m.outLog, [[0x04, 0x0f], [0x04, 0x00]], "out 0x04: (DE) then 0");
  assert.deepEqual(m.inLog, [0x03, 0x03], "two in 0x03 reads");
  assert.equal(m.regs.a, 0x03, "A = last ora m result");
  assert.equal(m.regs.hl, 0x2520, "HL stepped by 0x20 for the next row");
  assert.equal(m.regs.de, 0x3001, "DE advanced by 1");
  assert.equal(m.regs.bc, 0x0000, "B counted to 0, C preserved");
  assert.equal(m.tstates, 17 + 4 + 13 + 262 + 10, "call+xra+sta + one loop iter(262) + ret");
  assert.deepEqual(m.calls, [0x1474], "one internal setup call");
  assert.equal(m.pc, 0x1494, "ARTIFACT: ret pops the internal call's return (0x1494)");
  assert.equal(m.regs.sp, 0x2400, "SP balanced back to entry");
});

test("loc_1491: no-collision row leaves 0x2061 at 0", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2500; m.regs.de = 0x3000; m.regs.b = 0x01; m.regs.c = 0x00;
  m.mem.write8(0x3000, 0x0f);
  m.mem.write8(0x2500, 0x00);  // no overlap in either column
  m.mem.write8(0x2501, 0x00);
  m.inQueue = [0xff, 0xff];
  loc_1491(m);
  assert.equal(m.mem.read8(0x2061), 0x00, "no overlap -> collision flag stays 0");
  assert.equal(m.mem.read8(0x2500), 0xff, "col0: 0xff | 0x00");
  assert.equal(m.mem.read8(0x2501), 0xff, "col1: 0xff | 0x00");
});

test("loc_1491 MUTATION: dad b mis-charged 11T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2500; m.regs.de = 0x3000; m.regs.b = 0x01; m.regs.c = 0x00;
  m.mem.write8(0x3000, 0x0f); m.mem.write8(0x2500, 0x08); m.mem.write8(0x2501, 0x03);
  m.inQueue = [0xff, 0x00];
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x14c5 ? 11 : c); // 0x14c5 = landing after dad b
  loc_1491(m);
  assert.equal(m.tstates, 307, "dad b +1T -> 306 + 1");
  assert.notEqual(m.tstates, 306, "golden T-state total catches the mutant");
});
