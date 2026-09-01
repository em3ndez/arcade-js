// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1424 (ROM 0x1424-0x1438): call 0x1474 then zero two tiles per row over
// B rows, HL += 0x20 each pass. call is record-only so loc_1474 does not balance the stack -- the
// internal push16(0x1427) stays until the final ret pops it (a mock artifact, asserted below).
//
// Run: node --test games/invaders/translated/test/loc_1424.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1424 } from "../loc_1424.js";

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

test("loc_1424: call 0x1474, then clear 2 rows of 2 tiles; HL steps by 0x20; 237 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.bc = 0x0200; // B=2 rows
  m.regs.hl = 0x9000;

  loc_1424(m);

  assert.equal(m.mem.read8(0x9000), 0x00, "row0 tile0 cleared");
  assert.equal(m.mem.read8(0x9001), 0x00, "row0 tile1 cleared");
  assert.equal(m.mem.read8(0x9020), 0x00, "row1 tile0 cleared");
  assert.equal(m.mem.read8(0x9021), 0x00, "row1 tile1 cleared");
  assert.equal(m.regs.hl, 0x9040, "HL advanced by 0x20 per row twice");
  assert.equal(m.regs.b, 0x00, "row counter B ran to 0");
  assert.equal(m.tstates, 17 + 105 + 105 + 10, "call + 2*(loop body) + ret");
  assert.deepEqual(m.calls, [0x1474], "delegates to loc_1474 once");
  assert.equal(m.mem.read16(0x23fe), 0x1427, "call 0x1474 pushed return addr 0x1427");
  assert.equal(m.pc, 0x1427, "record-only call left 0x1427 on stack; final ret pops it");
});

test("loc_1424 MUTATION: `dad b` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.regs.bc = 0x0200;
  m.regs.hl = 0x9000;
  const realStep = m.step.bind(m);
  // dad b lands at 0x1433; charge it 7 instead of 10 (loses 3 T per row, 6 total)
  m.step = (n, c) => realStep(n, n === 0x1433 ? 7 : c);
  loc_1424(m);
  assert.notEqual(m.tstates, 17 + 105 + 105 + 10, "golden T-state total catches the mutant");
});
