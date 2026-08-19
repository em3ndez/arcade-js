// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f30 (ROM 0x0f30-0x0f3e): queue three sound commands (0x95, 0x03, 0x11)
// via enqueue helper 0x0ea2. The first two are pattern-A calls (push 0x0f35 / 0x0f3a, then call);
// 0x0ea2 is plain-ret, so the stub MUST run m.ret() to pop each return. The last is a tail-jp; its
// ret carries control back to loc_0f30's caller.
// Run: node --test games/pooyan/translated/test/loc_0f30.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f30 } from "../loc_0f30.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], aAtCall: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); this.aAtCall.push(this.regs.a); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0f30: A=0x95,0x03,0x11 -> 0x0ea2 x3; balanced; 95 T", () => {
  const m = makeMachine();
  seatCaller(m);
  loc_0f30(m);
  assert.equal(m.tstates, 95, "T = (7+17+10) + (7+17+10) + (7+10+10)");
  assert.deepEqual(m.calls, [0x0ea2, 0x0ea2, 0x0ea2], "three commands delegate to loc_0ea2");
  assert.deepEqual(m.aAtCall, [0x95, 0x03, 0x11], "A = 0x95, 0x03, 0x11 at the three delegations");
  assert.equal(m.pc, CALLER_RET, "tail enqueue's ret returns to loc_0f30's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (both pattern-A returns popped, caller ret popped)");
  assert.deepEqual(m.pcSeq,
    [0x0f32, 0x0ea2, 0x0f35, 0x0f37, 0x0ea2, 0x0f3a, 0x0f3c, 0x0ea2, CALLER_RET],
    "step boundaries");
});

test("loc_0f30 MUTATION: 2nd `call 0x0ea2` mis-charged 10T (as jp, not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  let seen = 0;
  m.step = (n, c) => { if (n === 0x0ea2 && ++seen === 2) return realStep(n, 10); return realStep(n, c); };
  loc_0f30(m);
  assert.equal(m.tstates, 88, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 95, "golden T-state total catches the mutant");
});
