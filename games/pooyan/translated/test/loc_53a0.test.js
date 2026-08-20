// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_53a0 (ROM 0x53a0, Pooyan) -- a thin wrapper that seeds C=0xff, calls
 * 0x5733 (a boundary), then returns. The mock's `call` POPS the return address the call site pushed
 * (modelling the callee's `ret`), so a missing push16 desyncs the stack and the balance assertion fails.
 *
 * Single path: ld c,0xff (7) -> call 0x5733 (17) -> ret (10) = 34 T. pcSeq visits the call TARGET 0x5733,
 * then the seated caller return. TEETH: mis-charge `call` as 10 T (not 17) -> the 34-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_53a0.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_53a0 } from "../loc_53a0.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x53a0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The callee's `ret` pops the return address loc_53a0 pushed at the call site -- model that pop so
    // the stack stays balanced (a missing push16 then desyncs SP and the balance assertion fails).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_53a0: seed C, call 0x5733, ret", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_53a0(m);

  assert.equal(m.tstates, 34, "T = ld c,n (7) + call (17) + ret (10)");
  assert.deepEqual(m.pcSeq, [0x53a2, 0x5733, CALLER_RET], "visits the call target then the seated caller");
  assert.equal(m.pc, CALLER_RET, "ret lands on the seated caller return");
  assert.equal(m.regs.c, 0xff, "C seeded to 0xff");
  assert.deepEqual(m.calls, [0x5733], "one call to the boundary 0x5733");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (push16 matched the callee ret)");
});

test("loc_53a0 MUTATION: `call` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5733 ? 10 : cycles);
  seatCaller(m);

  loc_53a0(m);

  assert.equal(m.tstates, 27, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 34, "golden"),
    /34/,
    "the 34-T golden must fail on the mutant",
  );
});
