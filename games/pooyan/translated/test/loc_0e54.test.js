// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0e54 (ROM 0x0e54-0x0e63): queues display-list entry 0x0701 (rst 0x38),
// then a second entry 0x0606 only when the counter at (0x882c) has reached 0x0f. rst 0x38 (loc_0038)
// is a returning callee, stubbed to balance its pushed return.
//
// Run: node --test games/pooyan/translated/test/loc_0e54.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0e54 } from "../loc_0e54.js";

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
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.regs.sp = (this.regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

function assertPathA(m) {
  assert.equal(m.tstates, 63, "Path A T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "the one rst 0x38 push balanced");
  assert.deepEqual(m.calls, [0x0038], "one display-list append");
  assert.equal(m.regs.de, 0x0701, "DE = first entry (second skipped)");
}

test("loc_0e54 Path A: (0x882c) != 0x0f -> single entry then ret; 63 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x05);

  loc_0e54(m);

  assertPathA(m);
  assert.deepEqual(m.pcSeq, [0x0e57, 0x0038, 0x0e5b, 0x0e5d, 0x0e63, CALLER_RET], "step boundaries");
});

test("loc_0e54 Path B: (0x882c) == 0x0f -> two entries then ret; 79 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x0f);

  loc_0e54(m);

  assert.equal(m.tstates, 79, "Path B T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "both rst 0x38 pushes balanced");
  assert.deepEqual(m.calls, [0x0038, 0x0038], "two display-list appends");
  assert.equal(m.regs.de, 0x0606, "DE = second entry");
  assert.deepEqual(m.pcSeq, [0x0e57, 0x0038, 0x0e5b, 0x0e5d, 0x0e5f, 0x0e62, 0x0038, CALLER_RET], "step boundaries");
});

test("loc_0e54 MUTATION: `ld a,(0x882c)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x882c, 0x05);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0e5b ? 7 : c);
  loc_0e54(m);
  assert.equal(m.tstates, 57, "mutation loses 6 T (13 -> 7)");
  assert.throws(() => assertPathA(m), /Path A T-state total/, "golden T-state assertion catches the mutant");
});
