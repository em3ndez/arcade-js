// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_4350 (ROM 0x4350, Pooyan) -- an object state handler. Ticks loc_4006,
 * counts down the (ix+0x11) phase timer (ret nz while it runs), then steps (ix+0x02) and re-arms the
 * animation script by tail-jumping into loc_4221's interior labels: 0x425c when (ix+0x08) bit0 is clear,
 * else 0x423a. Those two targets are boundaries (loc_4221 interior reached by an external jp).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling the callee's `ret`), so a
 * missing push16 desyncs the stack. Paths: TIMER (timer still running -> ret nz), ZTAIL (timer lapses,
 * bit0 clear -> tail 0x425c), NZTAIL (timer lapses, bit0 set -> tail 0x423a). MUTATION: mis-charge
 * `bit 0,(ix+0x08)` (20 T) as 8 T -> the 98-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_4350.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_4350 } from "../loc_4350.js";

const CALLER_RET = 0xabcd;
const IX = 0x8c00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x4350, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so a missing
    // push16 desyncs the stack and the final unwind misses CALLER_RET.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_4350 TIMER: (ix+0x11) still running after dec -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x05);

  loc_4350(m);

  assert.equal(m.tstates, 17 + 23 + 11, "TIMER path T-state total (51)");
  assert.deepEqual(m.pcSeq, [0x4006, 0x4356, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nz at 0x4356 to the seated caller");
  assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(IX + 0x11), 0x04, "timer decremented 0x05 -> 0x04");
  assert.equal(m.mem.read8(IX + 0x02), 0x00, "(ix+0x02) untouched while timer runs");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_4350 ZTAIL: timer lapses, (ix+0x08) bit0 clear -> tail 0x425c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x01); // dec -> 0 -> ret nz not taken
  m.mem.write8(IX + 0x02, 0x09);
  m.mem.write8(IX + 0x08, 0x00); // bit0 clear -> jp z taken

  loc_4350(m);

  assert.equal(m.tstates, 17 + 23 + 5 + 23 + 20 + 10, "ZTAIL path T-state total (98)");
  assert.deepEqual(m.pcSeq, [0x4006, 0x4356, 0x4357, 0x435a, 0x435e, 0x425c]);
  assert.equal(m.pc, 0x425c, "jp z tail lands on loc_4221 interior 0x425c");
  assert.deepEqual(m.calls, [0x4006, 0x425c]);
  assert.equal(m.mem.read8(IX + 0x11), 0x00, "timer 0x01 -> 0x00");
  assert.equal(m.mem.read8(IX + 0x02), 0x08, "(ix+0x02) decremented 0x09 -> 0x08");
  // Tail jp: 0x425c's eventual ret pops the seated CALLER_RET -> SP unwinds to the pre-seat baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (every push16 matched a callee ret)");
});

test("loc_4350 NZTAIL: timer lapses, (ix+0x08) bit0 set -> tail 0x423a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x02, 0x09);
  m.mem.write8(IX + 0x08, 0x01); // bit0 set -> jp z not taken -> jp 0x423a

  loc_4350(m);

  assert.equal(m.tstates, 17 + 23 + 5 + 23 + 20 + 10 + 10, "NZTAIL path T-state total (108)");
  assert.deepEqual(m.pcSeq, [0x4006, 0x4356, 0x4357, 0x435a, 0x435e, 0x4361, 0x423a]);
  assert.equal(m.pc, 0x423a, "jp tail lands on loc_4221 interior 0x423a");
  assert.deepEqual(m.calls, [0x4006, 0x423a]);
  assert.equal(m.mem.read8(IX + 0x02), 0x08, "(ix+0x02) decremented 0x09 -> 0x08");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_4350 MUTATION: `bit 0,(ix+0x08)` mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x435e ? 8 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x11, 0x01);
  m.mem.write8(IX + 0x08, 0x00);

  loc_4350(m);

  assert.equal(m.tstates, 86, "mutation loses 12 T (20 -> 8)");
  assert.throws(
    () => assert.equal(m.tstates, 98, "ZTAIL path T-state total"),
    /98/,
    "the 98-T golden must fail on the mutant",
  );
});
