// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0817 (ROM 0x0817-0x081e): `jmp 0x0817` entry -- two calls (B:=0x20 for the
// last), then tail-delegate (fall-through) into the main frame loop loc_081f. The mock records m.call
// targets rather than running them, so this pins the B write, the exact T-states (MAME i8080), the two
// call return addresses, and the delegate.
//
// Run: node --test games/invaders/translated/test/loc_0817.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_0817 } from "../loc_0817.js";

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

test("loc_0817: calls 19d1+18fa (B:=0x20), delegates to 081f; 41 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;

  loc_0817(m);

  assert.equal(m.regs.b, 0x20, "B := 0x20 (mvi b,0x20)");
  assert.equal(m.tstates, 17 + 7 + 17, "T total: call(17)+mvi(7)+call(17)");
  assert.equal(m.pc, 0x18fa, "last step lands at the second callee");
  assert.deepEqual(m.calls, [0x19d1, 0x18fa, 0x081f], "two calls then fall-through delegate to loc_081f");
  assert.deepEqual(m.pcSeq, [0x19d1, 0x081c, 0x18fa], "step boundaries");
  assert.equal(m.regs.sp, 0x23fc, "SP: 0x2400 - two 2-byte pushes");
  assert.equal(m.mem.read16(0x23fe), 0x081a, "call 0x19d1 pushes return addr 0x081a");
  assert.equal(m.mem.read16(0x23fc), 0x081f, "call 0x18fa pushes return addr 0x081f");
});

test("loc_0817 MUTATION: `call 0x18fa` mis-charged 11T (cond not-taken) not 17T is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x18fa ? 11 : c);
  loc_0817(m);
  assert.equal(m.tstates, 17 + 7 + 11, "mutation loses 6 T (17 -> 11)");
  assert.notEqual(m.tstates, 41, "golden T-state total catches the mutant");
});
