// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0728 (ROM 0x0728, Pooyan) -- the tail of the
 * sprite-attribute copy loop: second `inc ix`, then `djnz 0x0714`. Self-contained mock
 * machine (real Regs, flat 64K RAM, step/call/ret mirroring the DK Machine). The loop-back
 * crosses a routine boundary, so a taken djnz delegates via `m.call(0x0714)`; when B hits
 * 0 the routine `ret`s, so the mock seats a known caller return to prove that exit.
 *
 * Opcode boundaries cross-checked against MAME's executed-PC log (0728,072a,072c).
 *
 * Two paths: djnz taken (B=3 -> B=2, jump 0x0714, 23 T) and not-taken (B=1 -> B=0, ret,
 * 28 T). TEETH: mis-charge the taken `djnz` (13 T) as 8 T (the not-taken timing) -- the
 * 23-T golden MUST catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_0728.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0728 } from "../loc_0728.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0728, pcSeq: [],
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

test("loc_0728 djnz taken: B=3 -> inc ix, jump back to loc_0714", () => {
  const m = makeMachine();
  m.regs.b = 0x03;
  m.regs.ix = 0x9411;
  loc_0728(m);
  assert.equal(m.tstates, 23, "inc ix (10) + djnz taken (13)");
  assert.equal(m.regs.ix, 0x9412, "second inc ix of the iteration");
  assert.equal(m.regs.b, 0x02, "djnz decremented B");
  assert.equal(m.pc, 0x0714, "delegates back to the loop body");
  assert.deepEqual(m.calls, [0x0714], "taken djnz -> m.call(0x0714)");
  assert.deepEqual(m.pcSeq, [0x072a, 0x0714], "step boundaries");
});

test("loc_0728 djnz not taken: B=1 -> B=0, ret to caller", () => {
  const m = makeMachine();
  m.regs.b = 0x01;
  m.regs.ix = 0x9411;
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  loc_0728(m);
  assert.equal(m.tstates, 28, "inc ix (10) + djnz not-taken (8) + ret (10)");
  assert.equal(m.regs.b, 0x00, "djnz decremented B to 0");
  assert.equal(m.pc, CALLER_RET, "loop done -> ret pops the caller");
  assert.deepEqual(m.calls, [], "no delegation on the exit path");
  assert.deepEqual(m.pcSeq, [0x072a, 0x072c, CALLER_RET], "step boundaries");
});

test("loc_0728 MUTATION: taken `djnz` mis-charged 8T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0714 ? 8 : cycles);
  m.regs.b = 0x03;
  m.regs.ix = 0x9411;
  loc_0728(m);
  assert.equal(m.tstates, 18, "mutation loses 5 T (13 -> 8)");
  assert.throws(
    () => assert.equal(m.tstates, 23, "inc ix (10) + djnz taken (13)"),
    /inc ix/, "the 23-T golden must fail on the mutant",
  );
});
