// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1090 (ROM 0x1090, Pooyan) -- main-loop sub-state 2 handler:
 * a frame-delay countdown at 0x8f62. If (0x8f62) is nonzero, `dec (hl)` and ret (keep waiting).
 * When it reaches zero the `jr z` is taken into loc_1099: `inc (0x8f5c)` (advance the sub-state
 * selector), load DE=0x0634 and `rst 0x38` (loc_0038 display-cmd enqueue), then ret.
 *
 * Pinned paths:
 *   counting (0x8f62=0x05, nonzero -> and a => NZ): jr z NOT taken, dec (hl), ret.
 *     T = 10 + 7 + 4 + 7(jr nt) + 11 + 10 = 49. No calls. (0x8f62) 0x05 -> 0x04. Returns to caller.
 *   expired (0x8f62=0x00 -> and a => Z): jr z taken -> loc_1099.
 *     T = 10 + 7 + 4 + 12(jr taken) + 10 + 11 + 10 + 11(rst) + 10(ret) = 85. calls=[0x0038].
 *     (0x8f5c) bumped by 1, DE=0x0634. Stack: rst pushes 0x10a1 (consumed by loc_0038's ret),
 *     then the trailing ret pops the seated caller.
 *
 * The mock `call` POPS the seated return (modeling loc_0038's own ret) so the trailing ret pops
 * the true caller -- a non-popping mock would mask a stack imbalance here.
 *
 * TEETH: mis-charge `ld hl,0x8f62` (10 T) as 7 T on the counting path -- the golden must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_1090.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1090 } from "../loc_1090.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1090, pcSeq: [],
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
    // model loc_0038's own ret consuming the rst-seated return, so a leak surfaces at the trailing ret
    call(addr, site) { this.calls.push(addr); this.site = site; this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1090: counting (0x8f62=0x05) decrements and returns without dispatch", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f62, 0x05); // nonzero -> and a => NZ, jr z not taken
  loc_1090(m);

  assert.equal(m.tstates, 49, "T = 10+7+4+7(jr nt)+11+10(ret)");
  assert.deepEqual(m.pcSeq, [0x1093, 0x1094, 0x1095, 0x1097, 0x1098, CALLER_RET],
    "not-taken path: dec (hl) then ret to caller");
  assert.deepEqual(m.calls, [], "no dispatch while still counting");
  assert.equal(m.mem.read8(0x8f62), 0x04, "delay counter ticked 0x05 -> 0x04");
  assert.equal(m.mem.read8(0x8f5c), 0x00, "sub-state selector untouched");
  assert.equal(m.pc, CALLER_RET, "returned to seated caller");
  assert.equal(m.regs.sp, 0x8780, "SP balanced back to seat");
});

test("loc_1090: expired (0x8f62=0x00) advances selector and enqueues via rst 0x38", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f62, 0x00); // zero -> and a => Z, jr z taken
  m.mem.write8(0x8f5c, 0x02); // sub-state selector before the bump
  loc_1090(m);

  assert.equal(m.tstates, 85, "T = 10+7+4+12(jr taken)+10+11+10+11(rst)+10(ret)");
  assert.deepEqual(m.pcSeq, [0x1093, 0x1094, 0x1095, 0x1099, 0x109c, 0x109d, 0x10a0, 0x0038, CALLER_RET],
    "taken path falls into loc_1099, rst target, then ret to caller");
  assert.deepEqual(m.calls, [0x0038], "rst 0x38 delegates to the display-cmd enqueue loc_0038");
  assert.equal(m.mem.read8(0x8f5c), 0x03, "sub-state selector advanced 0x02 -> 0x03");
  assert.equal(m.mem.read8(0x8f62), 0x00, "delay counter left at 0x00 (not decremented on this path)");
  assert.equal(m.regs.de, 0x0634, "DE = display-cmd operand 0x0634 into the rst");
  assert.equal(m.pc, CALLER_RET, "trailing ret returns to the seated caller");
  assert.equal(m.regs.sp, 0x8780, "SP balanced: rst return consumed by loc_0038, caller popped by ret");
});

test("loc_1090 MUTATION: `ld hl,0x8f62` mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1093 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f62, 0x05);
  loc_1090(m);

  assert.equal(m.tstates, 46, "mutation loses 3 T (10 -> 7)");
});
