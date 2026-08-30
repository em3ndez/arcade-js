// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1016 (Pooyan ROM 0x1016) -- the main-loop sub-state 1 handler
 * (0x0fe3 dispatch table state 1 -> 0x1016). A straight-line block of ten `call`s then `ret`.
 *
 * This routine MAKES calls, so (per loc_10a2) the mock's `call` pops the return the routine pushed
 * (simulating each leaf's own `ret`), keeping SP balanced so the final `ret` recovers the caller.
 *
 * Pinned path -- the only path (no branches):
 *   Calls [0x1583,0x1042,0x107d,0x20d4,0x511b,0x1219,0x40bd,0x02ef,0x5ae4,0x0e64], then ret.
 *   T = 10 * 17 (call) + 10 (ret) = 180.
 *   SP returns to its pre-call value and the final ret lands on the seated caller return.
 *
 * TEETH: mis-charge the first `call 0x1583` (17 T) as 10 T -- the golden 180 must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_1016.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1016 } from "../loc_1016.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1016, pcSeq: [],
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
    // A leaf callee runs and RETs, netting SP unchanged: record the target, pop the return address.
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const EXPECTED_CALLS = [0x1583, 0x1042, 0x107d, 0x20d4, 0x511b, 0x1219, 0x40bd, 0x02ef, 0x5ae4, 0x0e64];
// Each call lands on its target; the final ret lands on the seated caller return.
const EXPECTED_PC_SEQ = [...EXPECTED_CALLS, CALLER_RET];

test("loc_1016: ten calls in order, then ret to the caller", () => {
  const m = makeMachine();
  seatCaller(m);
  const spBefore = m.regs.sp;
  loc_1016(m);

  assert.equal(m.tstates, 180, "T = 10*17 (call) + 10 (ret)");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "each call target in order, then the caller return");
  assert.deepEqual(m.calls, EXPECTED_CALLS, "ten subsystem calls in ROM order");
  assert.equal(m.pc, CALLER_RET, "final ret lands on the seated caller return");
  assert.equal(m.regs.sp, (spBefore + 2) & 0xffff, "SP balanced: net +2 from the ret popping the caller");
});

test("loc_1016 MUTATION: first `call 0x1583` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1583 ? 10 : cycles);
  seatCaller(m);
  loc_1016(m);

  assert.equal(m.tstates, 173, "mutation loses 7 T (17 -> 10)");
});
