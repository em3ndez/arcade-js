// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1452 (ROM 0x1452-0x1473): call setup 0x1474, then per row erase a shifted
// sprite -- AND the complement of (DE)/0 (via ports 0x04 out / 0x03 in) into (HL) and (HL+1),
// advancing DE by 1 and HL by 0x20. The mock's call is record-only, so the internal `call 0x1474`
// leaves its pushed return (0x1455) on the stack and the routine's ret pops THAT -- final PC =
// 0x1455 (documented artifact). io records portOut and feeds portIn from a queue.
//
// Run: node --test games/invaders/translated/test/loc_1452.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1452 } from "../loc_1452.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1452, pcSeq: [],
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

test("loc_1452: erases one row (AND ~shift) into (HL)/(HL+1), rets; 201 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2400;          // dest (record-only 0x1474 does not set it)
  m.regs.de = 0x2000;          // source pointer
  m.regs.b = 0x01;             // 1 row
  m.regs.c = 0x34;             // C preserved across push/pop b
  m.mem.write8(0x2000, 0xaa);  // (DE) -> out 0x04 for column 0
  m.mem.write8(0x2400, 0xff);  // field byte, column 0
  m.mem.write8(0x2401, 0xcc);  // field byte, column 1
  m.inQueue = [0x0f, 0x0f];    // in 0x03 results (col0, col1)

  loc_1452(m);

  assert.equal(m.mem.read8(0x2400), 0xf0, "col0: 0xff & ~0x0f");
  assert.equal(m.mem.read8(0x2401), 0xc0, "col1: 0xcc & ~0x0f");
  assert.deepEqual(m.outLog, [[0x04, 0xaa], [0x04, 0x00]], "out 0x04: (DE) then 0");
  assert.deepEqual(m.inLog, [0x03, 0x03], "two in 0x03 reads");
  assert.equal(m.regs.a, 0xc0, "A = last ana m result");
  assert.equal(m.regs.hl, 0x2420, "HL stepped by 0x20 for the next row");
  assert.equal(m.regs.de, 0x2001, "DE advanced by 1");
  assert.equal(m.regs.bc, 0x0034, "B counted to 0, C preserved");
  assert.equal(m.tstates, 17 + 174 + 10, "call(17) + one loop iter(174) + ret(10)");
  assert.deepEqual(m.calls, [0x1474], "one internal setup call");
  assert.equal(m.pc, 0x1455, "ARTIFACT: ret pops the internal call's return (0x1455)");
  assert.equal(m.regs.sp, 0x2400, "SP balanced back to entry");
});

test("loc_1452 MUTATION: dad b mis-charged 11T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.hl = 0x2400; m.regs.de = 0x2000; m.regs.b = 0x01; m.regs.c = 0x34;
  m.mem.write8(0x2000, 0xaa); m.mem.write8(0x2400, 0xff); m.mem.write8(0x2401, 0xcc);
  m.inQueue = [0x0f, 0x0f];
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x146e ? 11 : c); // 0x146e = landing after dad b
  loc_1452(m);
  assert.equal(m.tstates, 202, "dad b +1T -> 201 + 1");
  assert.notEqual(m.tstates, 201, "golden T-state total catches the mutant");
});
