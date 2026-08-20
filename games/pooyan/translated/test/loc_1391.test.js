// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1391 (ROM 0x1391, Pooyan) -- the (ix+0x08) bit0-set guard.
 * bit 0,(ix+0x08); ret nz (bit set); else tail jp loc_12d0. Reached only via jr nc from loc_1399,
 * so it runs in loc_1399's caller frame. The mock's `call` POPS (models the tail callee's ret
 * consuming the seated return), so the baseline assertion catches a stack desync.
 *
 * Path RET (bit0 set): bit + ret nz, pcSeq [0x1395, CALLER_RET], T=31. Path TAIL (bit0 clear):
 * bit + ret-nz-not + jp, pcSeq [0x1395, 0x1396, 0x12d0], T=35, tail into loc_12d0.
 * No push16 in this leaf, so the positive control is the T-state mutation tooth (bit 20T->8T).
 *
 * Run: node --test games/pooyan/translated/test/loc_1391.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1391 } from "../loc_1391.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1391, pcSeq: [],
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

function seatCaller(m) { m.regs.sp = BASE; m.push16(CALLER_RET); }

test("loc_1391 RET: (ix+0x08) bit0 set -> ret nz to the seated caller", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b08, 0x01); // bit0 set -> Z clear -> ret nz

  loc_1391(m);

  assert.equal(m.tstates, 31, "bit(20) + ret nz(11)");
  assert.deepEqual(m.pcSeq, [0x1395, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET, "ret nz lands on the seated caller");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, BASE, "stack fully unwound");
});

test("loc_1391 TAIL: (ix+0x08) bit0 clear -> jp loc_12d0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b08, 0x00); // bit0 clear -> Z set -> ret nz not taken

  loc_1391(m);

  assert.equal(m.tstates, 35, "bit(20) + ret-nz-not(5) + jp(10)");
  assert.deepEqual(m.pcSeq, [0x1395, 0x1396, 0x12d0]);
  assert.equal(m.pc, 0x12d0, "tail jp lands on loc_12d0");
  assert.deepEqual(m.calls, [0x12d0]);
  assert.equal(m.regs.sp, BASE, "tail callee ret pops the seated caller -> baseline");
});

test("loc_1391 MUTATION: bit mis-charged 8T (not 20T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1395 ? 8 : c);
  seatCaller(m);
  m.regs.ix = 0x8b00;
  m.mem.write8(0x8b08, 0x01);

  loc_1391(m);

  assert.equal(m.tstates, 19, "mutation loses 12 T (20 -> 8)");
  assert.throws(() => assert.equal(m.tstates, 31, "Path RET T-state total"), /31/);
});
