// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0ef9 (ROM 0x0ef9, Pooyan) -- the "append tile 0x07" shim:
 * ld a,0x07; jr 0x0ea2 (tail). The tail jr reuses the caller's frame, so loc_0ea2's ret
 * pops the seated CALLER_RET and the stack unwinds to the pre-seat baseline.
 *
 * The mock's `call` POPS (models loc_0ea2's ret consuming the seated return). Pure leaf with no
 * push16, so the positive control is a T-state mutation: mis-charge the jr (12 -> 7) and the
 * 19-T golden must throw.
 *
 * Run: node --test games/pooyan/translated/test/loc_0ef9.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0ef9 } from "../loc_0ef9.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0ef9, pcSeq: [],
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
    // callee `ret` pops the return the call site pushed; the tail jr pushed nothing, so this pops
    // the seated CALLER_RET (loc_0ea2 returns to loc_0ef9's caller). A missing m.call would leave
    // the stack un-unwound and fail the SP baseline tooth.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_0ef9: ld a,0x07 then tail jr into loc_0ea2", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0ef9(m);

  assert.equal(m.tstates, 19, "T = ld a,n (7) + jr (12)");
  assert.deepEqual(m.pcSeq, [0x0efb, 0x0ea2], "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x0ea2, "tail jr lands on 0x0ea2");
  assert.equal(m.regs.a, 0x07, "A = tile id 0x07");
  assert.deepEqual(m.calls, [0x0ea2], "one tail delegate to loc_0ea2");
  // Tail jr: loc_0ea2's ret pops the seated CALLER_RET, so the stack fully unwinds.
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail reuses the caller frame)");
});

test("loc_0ef9 MUTATION: jr mis-charged 7T (not 12T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0ea2 ? 7 : cycles);
  seatCaller(m);

  loc_0ef9(m);

  assert.equal(m.tstates, 14, "mutation loses 5 T (12 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 19, "T total"),
    /19/,
    "the 19-T golden must fail on the mutant",
  );
});
