// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_14cc (ROM 0x14cc-0x14d7): fill a vertical tile column with A, B rows,
// HL advancing by 0x20 per pass. Entered directly here (with A pre-set) to test the standalone
// head. No internal call, so a pre-seated caller return is popped by the final ret.
//
// Run: node --test games/invaders/translated/test/loc_14cc.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_14cc } from "../loc_14cc.js";

const CALLER_RET = 0xc0de;

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

test("loc_14cc: fills 2 rows with A, 0x20 stride; 136 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x0200; // B=2 rows
  m.regs.hl = 0x5000;
  m.regs.a = 0x7f;

  loc_14cc(m);

  assert.equal(m.mem.read8(0x5000), 0x7f, "row0 filled with A");
  assert.equal(m.mem.read8(0x5020), 0x7f, "row1 filled with A");
  assert.equal(m.regs.hl, 0x5040, "HL advanced 0x20 twice");
  assert.equal(m.regs.b, 0x00, "row counter B ran to 0");
  assert.equal(m.tstates, 63 + 63 + 10, "2*(loop body) + ret");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, CALLER_RET, "final ret returns to caller");
});

test("loc_14cc MUTATION: `dad b` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(CALLER_RET);
  m.regs.bc = 0x0200;
  m.regs.hl = 0x5000;
  m.regs.a = 0x7f;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x14d2 ? 7 : c); // dad b lands at 0x14d2
  loc_14cc(m);
  assert.notEqual(m.tstates, 63 + 63 + 10, "golden T-state total catches the mutant");
});
