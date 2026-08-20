// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1383 (ROM 0x1383, Pooyan) -- B-range guard.
 *   ld a,b; cp 0x20; ret nc   -- B >= 0x20 returns to the caller
 *   jr 0x13bc                 -- otherwise tail jp to the 0x13bc handler (untranslated boundary)
 *
 * The only transfer is the tail jr (no push16 anywhere), so the mock's `call` just pops the seated
 * CALLER_RET (modelling the tail callee's ret). Because there is no push16 to delete, the positive
 * control is a T-state mutation (below), not a push16 deletion.
 *
 * Paths: RET (B >= 0x20, T=22) and TAIL (B < 0x20, T=28).
 * TEETH: mis-charge `cp 0x20` (7 T) as 4 T -> the 22-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_1383.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1383 } from "../loc_1383.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1383, pcSeq: [],
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
    // The tail callee's `ret` pops the seated CALLER_RET -- model that pop so SP unwinds to baseline.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1383 Path RET: B >= 0x20 -> ret nc to caller", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x30;

  loc_1383(m);

  assert.equal(m.tstates, 22, "Path RET T-state total (4 + 7 + 11)");
  assert.deepEqual(m.pcSeq, [0x1384, 0x1386, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nc to seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_1383 Path TAIL: B < 0x20 -> jr 0x13bc (boundary)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x10;

  loc_1383(m);

  assert.equal(m.tstates, 28, "Path TAIL T-state total (4 + 7 + 5 + 12)");
  assert.deepEqual(m.pcSeq, [0x1384, 0x1386, 0x1387, 0x13bc]);
  assert.equal(m.pc, 0x13bc, "tail jr lands on 0x13bc");
  assert.deepEqual(m.calls, [0x13bc]);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline (tail callee ret pops CALLER_RET)");
});

test("loc_1383 MUTATION: `cp 0x20` mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1386 ? 4 : cycles);
  seatCaller(m);
  m.regs.b = 0x30;

  loc_1383(m);

  assert.equal(m.tstates, 19, "mutation loses 3 T (7 -> 4)");
  assert.throws(
    () => assert.equal(m.tstates, 22, "Path RET T-state total"),
    /22/,
    "the 22-T golden must fail on the mutant",
  );
});
