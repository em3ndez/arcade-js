// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0fc1 (ROM 0x0fc1, Pooyan) -- the A=0x29 alternate entry of loc_0fbc:
 * enqueue the four tiles 0x29,0x15,0x16,0x17 into the text ring via loc_0ea2 (three CALLs + a tail jp),
 * re-emitting loc_0fbc's shared 0x0fc3 tail. No entry `jp` (falls through), so 89 T vs loc_0fbc's 99.
 *
 * The mock's `call` POPS the return address the call site pushed (models loc_0ea2's ret); loc_0fc1
 * reloads A before every append, so loc_0ea2's clobbers are irrelevant to control flow. The tail jp
 * pushes nothing, so its callee ret consumes the seated CALLER_RET -> SP unwinds to the pre-seat
 * baseline (stack tooth). TEETH: mis-charge a `call` (17 T) as 10 T -> the 89-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_0fc1.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0fc1 } from "../loc_0fc1.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0fc1, pcSeq: [],
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
    // loc_0ea2's ret pops the return address loc_0fc1 pushed -- model that pop so a missing push16
    // desyncs the stack and the final SP-baseline assertion fails.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0fc1: append 0x29,0x15,0x16,0x17 -- three calls + tail jp into loc_0ea2", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0fc1(m);

  assert.equal(m.tstates, 89, "T-state total (loc_0fbc's 99 minus the 10-T entry jp it skips)");
  assert.deepEqual(m.pcSeq, [
    0x0fc3,           // ld a,0x29 falls through into the shared tail (no entry jp)
    0x0ea2, 0x0fc8,   // call 0x0ea2 -> target, then ld a,0x15 steps to 0x0fc8
    0x0ea2, 0x0fcd,   // call 0x0ea2 -> target, then ld a,0x16 steps to 0x0fcd
    0x0ea2, 0x0fd2,   // call 0x0ea2 -> target, then ld a,0x17 steps to 0x0fd2
    0x0ea2,           // tail jp 0x0ea2 -> target
  ], "step boundaries; entry falls through to 0x0fc3 (no 0x0fbe / no skip jp)");
  assert.equal(m.pc, 0x0ea2, "tail jp lands on 0x0ea2");
  assert.deepEqual(m.calls, [0x0ea2, 0x0ea2, 0x0ea2, 0x0ea2], "four loc_0ea2 appends");
  assert.equal(m.regs.a, 0x17, "A holds the final tile at the tail jp");
  // Tail jp pushes nothing; loc_0ea2's ret consumes the seated CALLER_RET -> back to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_0fc1 MUTATION: a `call` mis-charged 10T (not 17T) is caught by the golden", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let seen = 0;
  m.step = (nextAddr, cycles) => realStep(nextAddr, (nextAddr === 0x0ea2 && seen++ === 0) ? 10 : cycles);
  seatCaller(m);

  loc_0fc1(m);

  assert.equal(m.tstates, 82, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 89, "T-state total"),
    /89/,
    "the 89-T golden must fail on the mutant",
  );
});
