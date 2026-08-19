// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0f21 (ROM 0x0f21-0x0f2a): queue two sound commands (0x95 then 0x10) via
// enqueue helper 0x0ea2. The first is a pattern-A call (push 0x0f26, then call); 0x0ea2 is plain-ret,
// so the stub MUST run m.ret() to pop that return. The second is a tail-jp; its ret carries control
// back to loc_0f21's caller.
// Run: node --test games/pooyan/translated/test/loc_0f21.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f21 } from "../loc_0f21.js";

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

test("loc_0f21: A=0x95 -> call 0x0ea2, A=0x10 -> tail jp 0x0ea2; balanced; 61 T", () => {
  const m = makeMachine();
  seatCaller(m);
  loc_0f21(m);
  assert.equal(m.tstates, 61, "T = 7 + 17(call) + 10(ret) + 7 + 10(jp) + 10(ret)");
  assert.deepEqual(m.calls, [0x0ea2, 0x0ea2], "both commands delegate to loc_0ea2");
  assert.deepEqual(m.aAtCall, [0x95, 0x10], "A = 0x95 then 0x10 at the two delegations");
  assert.equal(m.pc, CALLER_RET, "tail enqueue's ret returns to loc_0f21's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (pattern-A push 0x0f26 popped, caller ret popped)");
  assert.deepEqual(m.pcSeq, [0x0f23, 0x0ea2, 0x0f26, 0x0f28, 0x0ea2, CALLER_RET], "step boundaries");
});

test("loc_0f21 MUTATION: `jp 0x0ea2` mis-charged 17T (as call, not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  let seen = 0;
  m.step = (n, c) => { if (n === 0x0ea2 && ++seen === 2) return realStep(n, 17); return realStep(n, c); };
  loc_0f21(m);
  assert.equal(m.tstates, 68, "mutation adds 7 T (10 -> 17)");
  assert.notEqual(m.tstates, 61, "golden T-state total catches the mutant");
});
