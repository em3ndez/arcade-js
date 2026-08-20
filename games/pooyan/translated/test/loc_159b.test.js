// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_159b (ROM 0x159b-0x15a0): tick loc_7912, load HL=0x15d1, then fall
// through into loc_15a1 (a tail delegate). Flat-RAM mock with real Regs. The `call 0x7912` is
// pattern-A and the fall-through is a delegate, so the FAITHFUL stub rets each (0 T): 0x7912 pops
// the 0x159e loc_159b pushed, the delegate 0x15a1 pops loc_159b's caller. A record-only stub would
// hide a leak, so the SP-balance assertion + positive control are the teeth.
//
// Run: node --test games/pooyan/translated/test/loc_159b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_159b } from "../loc_159b.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x159b, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.ret(0); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_159b: pattern-A call 0x7912 then delegate into loc_15a1; balanced; 27 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_159b(m);

  assert.equal(m.tstates, 27, "own T = 17 (call) + 10 (ld hl)");
  assert.equal(m.regs.hl, 0x15d1, "HL seeded with the handler return address");
  assert.equal(m.pc, CALLER_RET, "the loc_15a1 delegate's return lands on loc_159b's caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced -- pattern-A call does NOT leak");
  assert.deepEqual(m.calls, [0x7912, 0x15a1], "tick then dispatch");
  assert.deepEqual(m.pcSeq, [0x7912, 0x159e, 0x15a1, CALLER_RET],
    "call steps to 0x7912 (rets to 0x159e), then the fall-through delegates to 0x15a1");
});

// ── POSITIVE CONTROL: dropping the pattern-A push16(0x159e) leaks -> SP drifts ───────────────────
test("loc_159b POSITIVE CONTROL: dropping the call's push16 (pattern-B) leaves SP unbalanced", () => {
  const m = makeMachine();
  seatCaller(m);
  let dropped = false;
  const realPush = m.push16.bind(m);
  m.push16 = (v) => { if (!dropped && v === 0x159e) { dropped = true; return; } return realPush(v); };

  loc_159b(m);

  assert.notEqual(m.regs.sp, 0x8780, "a missing push16 leaks -> SP drifts (the pattern-B defect)");
});

test("loc_159b MUTATION: a mis-charged `call 0x7912` step (17T->10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7912 ? 10 : c);

  loc_159b(m);

  assert.equal(m.tstates, 20, "mutation drops 7 T");
  assert.notEqual(m.tstates, 27, "golden T catches the dropped step");
});
