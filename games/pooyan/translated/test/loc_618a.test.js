// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_618a (ROM 0x618a, Pooyan) -- clear (0x8d44), then SKIP-RETURN:
 * `pop af` discards the return the caller's `call` pushed, so `ret` lands one frame up (grandparent).
 *
 * loc_618a is a pure leaf (no calls), so the mock has no `call`; the stack fidelity here is the
 * skip-return: seat TWO returns (grandparent RET_OUTER below, RET_INNER on top). `pop af` loads
 * RET_INNER into AF and `ret` lands on RET_OUTER, unwinding to baseline.
 * TEETH: mis-charge `ld (0x8d44),a` (13 T) as 10 T -> the 37-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_618a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_618a } from "../loc_618a.js";

const RET_OUTER = 0x1234; // grandparent -- where the skip-return lands
const RET_INNER = 0xabcd; // the return the caller's `call` pushed -- discarded by `pop af`

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, tstates: 0, pc: 0x618a, pcSeq: [],
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
  };
}

function seat(m) {
  m.regs.sp = 0x8780;
  m.push16(RET_OUTER);
  m.push16(RET_INNER);
}

test("loc_618a: clear (0x8d44), pop af discards inner return, ret skips to grandparent", () => {
  const m = makeMachine();
  seat(m);

  loc_618a(m);

  assert.equal(m.tstates, 37, "T = xor a + ld (nn),a + pop af + ret = 4+13+10+10");
  assert.deepEqual(m.pcSeq, [0x618b, 0x618e, 0x618f, RET_OUTER], "step boundaries");
  assert.equal(m.pc, RET_OUTER, "ret lands on the grandparent (skip-return)");
  assert.equal(m.mem.read8(0x8d44), 0x00, "(0x8d44) cleared");
  assert.equal(m.regs.af, RET_INNER, "pop af loaded the discarded inner return");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (both returns consumed)");
});

test("loc_618a MUTATION: `ld (0x8d44),a` mis-charged 10T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x618e ? 10 : cycles);
  seat(m);

  loc_618a(m);

  assert.equal(m.tstates, 34, "mutation loses 3 T (13 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 37, "golden"),
    /37/,
    "the 37-T golden must fail on the mutant",
  );
});
