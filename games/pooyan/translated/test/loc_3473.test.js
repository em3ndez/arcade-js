// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_3473 (ROM 0x3473, Pooyan) -- the interior-entry mirror of
 * loc_343e's 0x3473 block, jp'd into by loc_34f2. Gates on 0x8f63, bumps the animation phase
 * (0x8d43, capped at 0x07), re-arms the sprite row via rst 0x20 (0x3418 table) + the 0x86e3
 * band, then falls through into the shared movement tail loc_34b0.
 *
 * The mock's `call` POPS: the rst 0x20 pushes 0x3495 (balanced by the pop), and the fall-through
 * tail into loc_34b0 reuses the frame so loc_34b0's ret pops the seated CALLER_RET -> SP returns
 * to the pre-seat baseline. A missing push16 before the rst desyncs SP (the balance tooth).
 *
 * Paths: LATCH (0x8f63!=0 -> (ix+1)=1, ret 0x347e); TAIL (phase>=0x07 -> jr nc loc_34b0);
 * REARM (phase<0x07 -> inc, rst 0x20, 0x86e3 band, fall into loc_34b0). The 0x348d jr nc TAKEN
 * edge is unreachable (reaching 0x348d needs phase<0x07, so `cp 0x0a` always sets carry) -- dead
 * ROM code, documented not tested. TEETH: `add hl,de` (11T) mis-charged 7T caught by REARM golden.
 *
 * Run: node --test games/pooyan/translated/test/loc_3473.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3473 } from "../loc_3473.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a00;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x3473, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_3473 LATCH: 0x8f63!=0 -> latch (ix+1)=1, ret at 0x347e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f63, 0x01);

  loc_3473(m);

  assert.deepEqual(m.pcSeq, [0x3476, 0x3477, 0x347a, 0x347e, CALLER_RET], "LATCH boundaries");
  assert.equal(m.tstates, 56, "LATCH T-total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(IX + 0x01), 0x01, "(ix+1) latched");
});

test("loc_3473 TAIL: phase>=0x07 -> jr nc loc_34b0 (tail)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f63, 0x00); // jp z taken -> 0x347f
  m.mem.write8(0x8d43, 0x08); // >= 0x07 -> jr nc taken

  loc_3473(m);

  assert.deepEqual(m.pcSeq, [
    0x3476, 0x3477, 0x347f, 0x3483, 0x3486, 0x3487, 0x3489, 0x34b0,
  ], "TAIL boundaries");
  assert.equal(m.tstates, 82, "TAIL T-total");
  assert.equal(m.pc, 0x34b0, "tail into loc_34b0");
  assert.deepEqual(m.calls, [0x34b0]);
  assert.equal(m.regs.sp, 0x8780);
  assert.equal(m.mem.read8(IX + 0x01), 0x00, "(ix+1) cleared at 0x347f");
});

test("loc_3473 REARM: phase<0x07 -> inc, rst 0x20, 0x86e3 band, fall into loc_34b0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f63, 0x00);
  m.mem.write8(0x8d43, 0x03); // < 0x07 -> jr nc not taken; < 0x0a -> inc (hl)

  loc_3473(m);

  assert.deepEqual(m.pcSeq, [
    0x3476, 0x3477, 0x347f, 0x3483, 0x3486, 0x3487, 0x3489, 0x348b, 0x348d, 0x348f,
    0x3490, 0x3491, 0x3494, 0x0020, 0x3498, 0x349b, 0x349e, 0x34a0, 0x34a1, 0x34a3,
    0x34a5, 0x34a6, 0x34a8, 0x34a9, 0x34ab, 0x34ad, 0x34b0,
  ], "REARM boundaries (rst 0x20 visits 0x0020, then falls into loc_34b0)");
  assert.equal(m.tstates, 253, "REARM T-total");
  assert.equal(m.pc, 0x34b0, "fall-through tail into loc_34b0");
  assert.deepEqual(m.calls, [0x0020, 0x34b0], "rst 0x20 then the fall-through tail");
  assert.equal(m.regs.sp, 0x8780, "rst push16 balanced; tail pops seated CALLER_RET");
  assert.equal(m.mem.read8(IX + 0x01), 0x00, "(ix+1) cleared");
  assert.equal(m.mem.read8(0x8d43), 0x04, "phase incremented");
  assert.equal(m.mem.read8(0x86e3), 0xd8, "band tile 0");
  assert.equal(m.mem.read8(0x86e4), 0xd9, "band tile 1");
  assert.equal(m.mem.read8(0x8703), 0xda, "band tile 2 (hl += 0x1f)");
  assert.equal(m.mem.read8(0x8704), 0xdb, "band tile 3");
  assert.equal(m.mem.read8(0x8f63), 0x01, "0x8f63 armed");
});

test("loc_3473 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught on REARM", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x34a6 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f63, 0x00);
  m.mem.write8(0x8d43, 0x03);

  loc_3473(m);

  assert.equal(m.tstates, 249, "mutation loses 4 T");
  assert.throws(() => assert.equal(m.tstates, 253, "REARM golden"), /253/,
    "the 253-T golden must fail on the mutant");
});
