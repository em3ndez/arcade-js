// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_4179 (ROM 0x4179): a one-byte null handler that just `ret`s.
// PURE LEAF (no calls) -> the T-state mutation is the positive control (mutate ret 10T -> 4T).
//
// Run: node --test games/pooyan/translated/test/loc_4179.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4179 } from "../loc_4179.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_4179: ret only; 10 T, stack balanced", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_4179(m);

  assert.equal(m.tstates, 10, "ret = 10 T");
  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [], "no calls");
  assert.deepEqual(m.pcSeq, [CALLER_RET], "single ret boundary");
});

test("loc_4179 MUTATION (positive control): ret mis-charged 4T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, 4);

  loc_4179(m);

  assert.equal(m.tstates, 4, "mutation charges 4 T");
  assert.throws(
    () => assert.equal(m.tstates, 10, "ret = 10 T"),
    /10/,
    "the 10-T golden must fail on the mutant",
  );
});
