// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_0f6c (ROM 0x0f6c, Pooyan) -- enqueues two sound commands
 * (0x19 then 0x15) through loc_0eb3. First is a `call` (return 0x0f71 pushed, popped by loc_0eb3's
 * ret); the second is a tail `jp` (no push -- loc_0eb3's ret returns straight to loc_0f6c's caller).
 *
 * The mock's `call` POPS (models the callee's `ret` consuming the pushed return address): so the
 * call site's push16 and the tail jp's frame reuse both show up in SP. STACK TOOTH: after the tail
 * jp the stack unwinds to the pre-seat baseline (loc_0eb3's ret consumed the seated CALLER_RET); a
 * missing push16 at the `call` desyncs SP off baseline. T-STATE TOOTH: mis-charge the `call` (17T).
 *
 * Run: node --test games/pooyan/translated/test/loc_0f6c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f6c } from "../loc_0f6c.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0f6c, pcSeq: [],
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
    // loc_0eb3's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 desyncs the stack and fails the baseline tooth. loc_0eb3 preserves BC/DE/HL and the A it
    // consumes is reloaded (0x15) before the tail jp, so no register modelling is needed.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0f6c: enqueue sound 0x19 (call) then 0x15 (tail jp)", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0f6c(m);

  assert.equal(m.tstates, 7 + 17 + 7 + 10, "ld a + call + ld a + jp");
  assert.deepEqual(m.pcSeq, [0x0f6e, 0x0eb3, 0x0f73, 0x0eb3], "call + tail jp both visit 0x0eb3");
  assert.equal(m.pc, 0x0eb3, "tail jp lands on loc_0eb3");
  assert.deepEqual(m.calls, [0x0eb3, 0x0eb3], "two enqueues");
  assert.equal(m.regs.a, 0x15, "A = second sound command at the tail jp");
  // Tail jp: loc_0eb3's ret pops the seated CALLER_RET, so the stack fully unwinds to the pre-seat
  // baseline. A missing push16 at the 0x0f6e call would leave SP off by 2 here (stack-fidelity tooth).
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_0f6c MUTATION: `call 0x0eb3` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, (nextAddr === 0x0eb3 && cycles === 17) ? 10 : cycles);
  seatCaller(m);

  loc_0f6c(m);

  assert.equal(m.tstates, 41 - 7, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 41, "loc_0f6c T-state total"),
    /41/,
    "the 41-T golden must fail on the mutant",
  );
});
