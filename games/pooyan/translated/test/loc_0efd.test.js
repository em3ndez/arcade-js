// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0efd (ROM 0x0efd, Pooyan) -- sound/text command 0x08:
 * loads A=0x08 then tail-jr's into the text-ring appender loc_0ea2, whose ret returns to
 * loc_0efd's own caller (frame reuse -- no push16 here).
 *
 * The mock's `call` POPS the return address (models loc_0ea2's ret); on the tail jr that pop
 * consumes the seated CALLER_RET, so the stack unwinds to the pre-seat baseline. Pure leaf (no
 * push16 of its own): the T-state mutation tooth is the positive control here.
 *
 * Run: node --test games/pooyan/translated/test/loc_0efd.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0efd } from "../loc_0efd.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0efd, pcSeq: [],
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
    // The callee's `ret` pops whatever the call site pushed. loc_0efd tail-jr's with no push16 of its
    // own, so this pop consumes the seated CALLER_RET -- the stack-fidelity tooth below checks it.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0efd: A=0x08 then tail-jr into loc_0ea2", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0efd(m);

  assert.equal(m.tstates, 7 + 12, "ld a,n (7) + jr (12)");
  assert.deepEqual(m.pcSeq, [0x0eff, 0x0ea2], "step boundaries: ld a,n -> jr target");
  assert.equal(m.pc, 0x0ea2, "tail jr lands on loc_0ea2");
  assert.deepEqual(m.calls, [0x0ea2], "single tail call into loc_0ea2");
  assert.equal(m.regs.a, 0x08, "A holds command tile 0x08");
  // Tail jr: loc_0ea2's ret pops the seated CALLER_RET, so the stack fully unwinds to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack unwound to pre-seat baseline (tail frame reuse)");
});

test("loc_0efd MUTATION: jr mis-charged 10T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0ea2 ? 10 : cycles);
  seatCaller(m);

  loc_0efd(m);

  assert.equal(m.tstates, 7 + 10, "mutation loses 2 T (12 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 7 + 12, "golden jr cost"),
    /19/,
    "the 19-T golden must fail on the mutant",
  );
});
