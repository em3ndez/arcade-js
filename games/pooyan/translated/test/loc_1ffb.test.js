// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1ffb (ROM 0x1ffb, Pooyan) -- pick a glyph table by bit5 of B and
 * render it via loc_3307 (a boundary; the mock's `call` models its `ret` by popping).
 *
 * Path A (B bit5 clear): DE = 0x203b, jr z taken. Path B (bit5 set): DE = 0x2050, jr z not taken.
 * Full pcSeq (visiting call target 0x3307) + T-state golden. MUTATION tooth: the call mis-charged 10T
 * (not 17T) is caught. POSITIVE CONTROL performed: deleting `m.push16(0x200c)` desyncs the stack so
 * the final `ret` misses CALLER_RET -- verified to fail, then restored.
 *
 * Run: node --test games/pooyan/translated/test/loc_1ffb.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1ffb } from "../loc_1ffb.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1ffb, pcSeq: [],
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
    // Callee `ret` pops the return address the call site pushed -- a missing push16 then desyncs SP.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1ffb Path A: B bit5 clear -> table 0x203b (jr z taken)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x00;

  loc_1ffb(m);

  assert.equal(m.tstates, 71, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1ffc, 0x1ffe, 0x2001, 0x2006, 0x2009, 0x3307, CALLER_RET,
  ], "Path A pcSeq (visits call target 0x3307)");
  assert.equal(m.pc, CALLER_RET, "ret returns to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (push16 matched the callee ret)");
  assert.equal(m.regs.de, 0x203b, "DE = table 0x203b");
  assert.equal(m.regs.hl, 0x8062, "HL = VRAM dest");
  assert.deepEqual(m.calls, [0x3307], "rendered via loc_3307");
});

test("loc_1ffb Path B: B bit5 set -> table 0x2050 (jr z not taken)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.b = 0x20;

  loc_1ffb(m);

  assert.equal(m.tstates, 76, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1ffc, 0x1ffe, 0x2001, 0x2003, 0x2006, 0x2009, 0x3307, CALLER_RET,
  ], "Path B pcSeq");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.equal(m.regs.de, 0x2050, "DE = table 0x2050");
});

test("loc_1ffb MUTATION: call 0x3307 mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x3307 ? 10 : cycles);
  seatCaller(m);
  m.regs.b = 0x00;

  loc_1ffb(m);

  assert.equal(m.tstates, 64, "mutation loses 7 T (17 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 71, "Path A T-state total"),
    /71/,
    "the 71-T golden must fail on the mutant",
  );
});
