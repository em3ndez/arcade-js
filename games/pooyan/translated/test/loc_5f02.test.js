// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5f02 (ROM 0x5f02, Pooyan) -- a call-and-return trampoline into
 * loc_0ef1. The mock's `call` POPS the return address the call site pushed (modelling loc_0ef1's
 * `ret`), so a missing push16 at 0x5f02 would leave SP off by 2 and land the final `ret` on the
 * wrong word -- the stack-fidelity tooth.
 *
 * Run: node --test games/pooyan/translated/test/loc_5f02.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5f02 } from "../loc_5f02.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5f02, pcSeq: [],
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
    // The callee's `ret` pops the return address loc_5f02 pushed at the call site; model that pop so
    // the stack stays balanced (a missing push16 then desyncs SP and the final ret misses CALLER_RET).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_5f02: call 0x0ef1 then ret to the seated caller", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_5f02(m);

  assert.equal(m.tstates, 17 + 10, "call 0x0ef1 (17) + ret (10)");
  assert.deepEqual(m.pcSeq, [0x0ef1, CALLER_RET], "step visits the call target, then the seated caller");
  assert.equal(m.pc, CALLER_RET, "ret lands on the seated caller");
  assert.deepEqual(m.calls, [0x0ef1], "one call to the loc_0ef1 boundary");
  // Stack fully unwinds: the push16(0x5f05) is popped by loc_0ef1's ret, the final ret pops CALLER_RET.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_5f02 MUTATION: `call 0x0ef1` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0ef1 ? 10 : cycles);
  seatCaller(m);

  loc_5f02(m);

  assert.equal(m.tstates, 20, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 27, "call 0x0ef1 (17) + ret (10)"),
    /27/,
    "the 27-T golden must fail on the mutant",
  );
});
