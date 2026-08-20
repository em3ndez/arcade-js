// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1410 (ROM 0x1410, Pooyan) -- stash A into (ix+5), latch B, then
 * branch on (0x8901): < 3 -> tail jp 0x1399; >= 3 -> fall through into loc_141c. Both exits are tails
 * (no push16), so the seated CALLER_RET is consumed by the tail callee's ret -> SP returns to baseline.
 *
 * The mock's `call` POPS (models the callee's ret). Paths: C (0x8901=0 -> jp 0x1399) and
 * NC (0x8901=5 -> fall into 0x141c). TEETH: mis-charge `ld a,(0x8901)` (13T) as 7T -> the 53-T golden throws.
 * Pure-tail routine (no push16), so the push16-deletion control is N/A -- the T-state mutation is the control.
 *
 * Run: node --test games/pooyan/translated/test/loc_1410.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1410 } from "../loc_1410.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1410, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_1410 Path C: (0x8901) < 3 -> tail jp 0x1399", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.regs.a = 0x42;
  m.mem.write8(0x8901, 0x00); // 0 < 3 -> cp 0x03 borrows -> carry set -> jp c taken

  loc_1410(m);

  assert.equal(m.tstates, 53, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [0x1413, 0x1414, 0x1417, 0x1419, 0x1399], "steps -> tail 0x1399");
  assert.equal(m.pc, 0x1399, "tail jp lands on 0x1399");
  assert.deepEqual(m.calls, [0x1399]);
  assert.equal(m.mem.read8(0x8b05), 0x42, "A stored into (ix+5)");
  assert.equal(m.regs.b, 0x42, "B latched from A");
  assert.equal(m.regs.sp, 0x8780, "tail callee's ret consumed CALLER_RET -> baseline");
});

test("loc_1410 Path NC: (0x8901) >= 3 -> fall through into loc_141c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.regs.a = 0x42;
  m.mem.write8(0x8901, 0x05); // 5 >= 3 -> no borrow -> carry clear -> fall through

  loc_1410(m);

  assert.equal(m.tstates, 53, "Path NC T-state total");
  assert.deepEqual(m.pcSeq, [0x1413, 0x1414, 0x1417, 0x1419, 0x141c], "steps -> fall into 0x141c");
  assert.equal(m.pc, 0x141c, "falls through to loc_141c");
  assert.deepEqual(m.calls, [0x141c]);
  assert.equal(m.mem.read8(0x8b05), 0x42, "A stored into (ix+5)");
  assert.equal(m.regs.sp, 0x8780, "tail callee's ret consumed CALLER_RET -> baseline");
});

test("loc_1410 MUTATION: `ld a,(0x8901)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1417 ? 7 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.regs.a = 0x42;
  m.mem.write8(0x8901, 0x00);

  loc_1410(m);

  assert.equal(m.tstates, 47, "mutation loses 6 T (13 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 53, "Path C T-state total"), /53/, "the 53-T golden must fail on the mutant");
});
