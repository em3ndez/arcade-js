// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1219 (ROM 0x1219-0x122b, Pooyan): the per-object update sweep.
// 14 records at IX=0x8ae0, stride DE=0x18; each pass `exx`-brackets a call to the
// per-object dispatcher loc_122c, then `add ix,de` and `djnz` back. Falls out to `ret`.
//
// loc_122c is treated as a plain-ret callee (pattern-A): the stub runs m.ret() to pop the
// pushed 0x1226 return, so the loop's stack is exercised for real (a record-only stub would
// hide a push/pop imbalance).
//
// T-state accounting (mock charges the callee's ret at 10 via call->ret, as loc_09f8 does):
//   setup      = 14 + 10 + 7                     = 31
//   pass(taken)= 4(exx)+17(call)+10(ret)+4(exx)+15(add)+13(djnz taken) = 63   x13 = 819
//   pass(last) = 4     +17     +10    +4     +15    + 8(djnz not taken) = 58   x1  =  58
//   final ret  = 10
//   total      = 31 + 819 + 58 + 10 = 918
//
// TEETH: mis-charge `add ix,de` (15 T) as 11 T -- the golden T-state must catch it.
//
// Run: node --test games/pooyan/translated/test/loc_1219.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1219 } from "../loc_1219.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1219, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // plain-ret callee: pop the pattern-A return so the loop's stack is exercised for real.
    call(addr, site) { this.calls.push(addr); this.site = site; this.ret(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_1219: 14-record sweep, IX += 14*0x18, 14 calls to 0x122c, 918 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_1219(m);

  assert.equal(m.tstates, 918, "full 14-iteration T-state total");
  assert.equal(m.pc, CALLER_RET, "returns to caller via final ret");
  assert.equal(m.regs.ix, 0x8c30, "IX advanced by 14 * 0x18 (0x8ae0 -> 0x8c30)");
  assert.equal(m.regs.b, 0x00, "loop counter drained");
  assert.equal(m.regs.de, 0x0018, "DE (record stride) unchanged");
  assert.equal(m.regs.sp, 0x8780, "stack balanced (14 pattern-A calls + final ret)");
  assert.deepEqual(m.calls, new Array(14).fill(0x122c), "14 per-object dispatcher calls");
});

test("loc_1219: boundary trace of the first two passes and the fall-out", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_1219(m);

  // setup, then 14 passes; passes 1..13 djnz back to 0x1222, pass 14 falls to 0x122b.
  const expected = [0x121d, 0x1220, 0x1222];
  for (let i = 0; i < 14; i++) {
    const last = i === 13;
    expected.push(0x1223, 0x122c, 0x1226, 0x1227, 0x1229, last ? 0x122b : 0x1222);
  }
  expected.push(CALLER_RET);

  assert.deepEqual(m.pcSeq, expected,
    "exx / call 0x122c (ret to 0x1226) / exx / add ix,de / djnz per pass, then ret");
});

test("loc_1219 MUTATION: `add ix,de` mis-charged 11T (not 15T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1229 ? 11 : cycles);
  seatCaller(m);

  loc_1219(m);

  // 14 add-ix passes each lose 4 T -> 918 - 56 = 862.
  assert.equal(m.tstates, 862, "mutation loses 4 T x 14 passes (15 -> 11)");
});
