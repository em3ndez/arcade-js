// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0f4e (ROM 0x0f4e-0x0f57): queue two sound commands (0x82 then 0x95) via
// the sound-latch helper 0x0eb3. The second call is a tail `jp 0x0eb3`, so loc_0f4e never ret's
// itself -- 0x0eb3's ret carries control back to loc_0f4e's caller. The mock records both delegations
// and, being a tail dispatch, does NOT balance the stack.
//
// Run: node --test games/pooyan/translated/test/loc_0f4e.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f4e } from "../loc_0f4e.js";

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
    regs, mem, ram, calls: [], aAtCall: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.aAtCall.push(this.regs.a); return undefined; },
  };
}

test("loc_0f4e: A=0x82 -> call 0x0eb3, A=0x95 -> tail jp 0x0eb3; 41 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;

  loc_0f4e(m);

  assert.equal(m.tstates, 41, "loc_0f4e T-state total");
  assert.deepEqual(m.calls, [0x0eb3, 0x0eb3], "both sound commands delegate to 0x0eb3");
  assert.deepEqual(m.aAtCall, [0x82, 0x95], "A = 0x82 then 0x95 at the two delegations");
  assert.equal(m.regs.a, 0x95, "A holds the last command after the tail jp");
  assert.deepEqual(m.pcSeq, [0x0f50, 0x0eb3, 0x0f55, 0x0eb3], "step boundaries");
});

test("loc_0f4e MUTATION: `jp 0x0eb3` mis-charged 17T (as a call, not 10T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  const realStep = m.step.bind(m);
  let seen = 0;
  m.step = (n, c) => { if (n === 0x0eb3 && ++seen === 2) return realStep(n, 17); return realStep(n, c); };
  loc_0f4e(m);
  assert.equal(m.tstates, 48, "mutation adds 7 T (10 -> 17)");
  assert.notEqual(m.tstates, 41, "golden T-state total catches the mutant");
});
