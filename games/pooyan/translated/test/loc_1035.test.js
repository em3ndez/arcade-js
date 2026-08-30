// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1035 (ROM 0x1035, Pooyan) -- the main-loop sub-state handler
 * tail. Runs four post-handler routines (0x2157, 0x1219, 0x40bd, 0x02ef) in sequence, then `ret`s
 * to the seated caller.
 *
 * Pinned path (only one; no branches):
 *   4 calls (17 T each) + ret (10 T) = 78 T.
 *   pcSeq = [0x1038, 0x103b, 0x103e, 0x1041, <caller ret>].
 *   calls = [0x2157, 0x1219, 0x40bd, 0x02ef].
 *   SP returns to its pre-call value (balanced): ret pops the seated caller return.
 *
 * TEETH: mis-charge the first `call 0x2157` (17 T) as 10 T -- the golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_1035.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1035 } from "../loc_1035.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1035, pcSeq: [],
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
    // model the callee running to its own ret: pop the return the site pushed so SP rebalances
    call(addr, site) { this.calls.push(addr); this.site = site; this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1035: runs the four post-handler calls then ret's to the caller", () => {
  const m = makeMachine();
  seatCaller(m);
  const spAfterSeat = m.regs.sp;
  loc_1035(m);

  assert.equal(m.tstates, 78, "T = 17+17+17+17 (calls) + 10 (ret)");
  assert.deepEqual(m.pcSeq, [0x2157, 0x1219, 0x40bd, 0x02ef, CALLER_RET],
    "advances through each call target then ret's to the seated caller");
  assert.deepEqual(m.calls, [0x2157, 0x1219, 0x40bd, 0x02ef],
    "the four post-handler routines in ROM order");
  assert.equal(m.pc, CALLER_RET, "PC lands on the caller return after ret");
  assert.equal(m.regs.sp, (spAfterSeat + 2) & 0xffff, "SP balanced: ret popped the caller return");
});

test("loc_1035 MUTATION: first `call 0x2157` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x2157 ? 10 : cycles);
  seatCaller(m);
  loc_1035(m);

  assert.equal(m.tstates, 71, "mutation loses 7 T (17 -> 10)");
});
