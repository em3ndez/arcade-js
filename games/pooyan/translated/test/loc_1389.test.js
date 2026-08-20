// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1389 (ROM 0x1389, Pooyan) -- the (ix+0x08) bit0-clear guard.
 * bit 0,(ix+0x08); ret z (bit clear); else tail jp loc_141c. Reached only via jr c from loc_1399,
 * so the guard runs in loc_1399's caller frame: ret z returns to that seated caller, and the tail
 * jp's callee ret also lands there. The mock's `call` POPS (models the tail callee's ret consuming
 * the seated return), so a stray push/pop desyncs SP -- the baseline assertion has teeth.
 *
 * Path RET (bit0 clear): bit + ret z, pcSeq [0x138d, CALLER_RET], T=31. Path TAIL (bit0 set):
 * bit + ret-z-not-taken + jp, pcSeq [0x138d, 0x138e, 0x141c], T=35, tail into loc_141c.
 * No push16 in this leaf, so the positive control is the T-state mutation tooth (bit 20T->8T).
 *
 * Run: node --test games/pooyan/translated/test/loc_1389.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1389 } from "../loc_1389.js";

const CALLER_RET = 0xabcd;
const BASE = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1389, pcSeq: [],
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
    // The tail callee's `ret` pops the seated return address -- model that pop so the stack balances.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = BASE; m.push16(CALLER_RET); }

test("loc_1389 RET: (ix+0x08) bit0 clear -> ret z to the seated caller", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b08, 0x00); // bit0 clear -> Z set -> ret z

  loc_1389(m);

  assert.equal(m.tstates, 31, "bit(20) + ret z(11)");
  assert.deepEqual(m.pcSeq, [0x138d, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret z lands on the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, BASE, "stack fully unwound");
});

test("loc_1389 TAIL: (ix+0x08) bit0 set -> jp loc_141c", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b08, 0x01); // bit0 set -> Z clear -> ret z not taken

  loc_1389(m);

  assert.equal(m.tstates, 35, "bit(20) + ret-z-not(5) + jp(10)");
  assert.deepEqual(m.pcSeq, [0x138d, 0x138e, 0x141c]);
  assert.equal(m.pc, 0x141c, "tail jp lands on loc_141c");
  assert.deepEqual(m.calls, [0x141c]);
  assert.equal(m.regs.sp, BASE, "tail callee ret pops the seated caller -> baseline");
});

test("loc_1389 MUTATION: bit mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x138d ? 8 : c); // bit b,(ix+d) is 20T, not 8T
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b08, 0x00);

  loc_1389(m);

  assert.equal(m.tstates, 19, "mutation loses 12 T (20 -> 8)");
  assert.throws(() => assert.equal(m.tstates, 31, "Path RET T-state total"), /31/);
});
