// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0eda (ROM 0x0eda-0x0ee2): queue two sound commands (0x82 then 0x03) via
// enqueue helper 0x0eb3. The first is a pattern-A call (push 0x0edf, then call); the enqueue is a
// plain-ret routine, so the stub MUST run m.ret() to pop that return -- a record-only stub would
// hide a missing push (pattern-B bug). The second is a tail-jr; its ret carries back to our caller.
// Run: node --test games/pooyan/translated/test/loc_0eda.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0eda } from "../loc_0eda.js";

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
    // plain-ret enqueue: pop the pattern-A / caller return so the stack is exercised for real.
    call(a) { this.calls.push(a); this.aAtCall.push(this.regs.a); this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0eda: A=0x82 -> call 0x0eb3, A=0x03 -> tail jr 0x0eb3; balanced; 63 T", () => {
  const m = makeMachine();
  seatCaller(m);
  loc_0eda(m);
  assert.equal(m.tstates, 63, "T = 7 + 17(call) + 10(ret) + 7 + 12(jr) + 10(ret)");
  assert.deepEqual(m.calls, [0x0eb3, 0x0eb3], "both commands delegate to loc_0eb3");
  assert.deepEqual(m.aAtCall, [0x82, 0x03], "A = 0x82 then 0x03 at the two delegations");
  assert.equal(m.pc, CALLER_RET, "tail enqueue's ret returns to loc_0eda's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (pattern-A push 0x0edf popped, caller ret popped)");
  assert.deepEqual(m.pcSeq, [0x0edc, 0x0eb3, 0x0edf, 0x0ee1, 0x0eb3, CALLER_RET], "step boundaries");
});

test("loc_0eda MUTATION: `call 0x0eb3` mis-charged 10T (as jp, not 17T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  let seen = 0;
  m.step = (n, c) => { if (n === 0x0eb3 && ++seen === 1) return realStep(n, 10); return realStep(n, c); };
  loc_0eda(m);
  assert.equal(m.tstates, 56, "mutation loses 7 T (17 -> 10)");
  assert.notEqual(m.tstates, 63, "golden T-state total catches the mutant");
});
