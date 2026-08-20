// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5f53 (ROM 0x5f53, Pooyan) -- the leaf collision pre-check. It has
 * no calls, so the positive control is a T-state mutation (below) rather than a push16 deletion.
 *
 * Path NZ (0x881f != 0 -> bias 6): screen X = (ix+0)+6, A = (ix+2)+8; A < 0xe0 -> carry set (on-screen).
 * Path Z  (0x881f == 0 -> bias -2): the `jr nz` is not taken, and A = (ix+2)+8 >= 0xe0 -> carry clear.
 * Together the two paths exercise both `jr nz` outcomes and both `cp 0xe0` outcomes.
 *
 * Run: node --test games/pooyan/translated/test/loc_5f53.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5f53 } from "../loc_5f53.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5f53, pcSeq: [],
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
}

test("loc_5f53 Path NZ: 0x881f != 0 -> bias 6, A=(ix+2)+8 < 0xe0 -> carry set", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x881f, 0x01); // nonzero -> jr nz taken, bias stays 6
  m.mem.write8(0x9000, 0x10); // (ix+0)
  m.mem.write8(0x9002, 0x20); // (ix+2)

  loc_5f53(m);

  assert.equal(m.tstates, 106, "Path NZ T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f55, 0x5f58, 0x5f59, 0x5f5d, // jr nz taken -> skip the bias override
    0x5f60, 0x5f61, 0x5f62, 0x5f65, 0x5f67, 0x5f69, CALLER_RET,
  ], "jr nz taken path");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.regs.e, 0x16, "E = (ix+0) + 6");
  assert.equal(m.regs.a, 0x28, "A = (ix+2) + 8");
  assert.equal(m.regs.fC, true, "carry set: A < 0xe0 (on-screen)");
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_5f53 Path Z: 0x881f == 0 -> bias -2, A=(ix+2)+8 >= 0xe0 -> carry clear", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x881f, 0x00); // zero -> jr nz not taken, bias -2
  m.mem.write8(0x9000, 0x30); // (ix+0)
  m.mem.write8(0x9002, 0xf0); // (ix+2)

  loc_5f53(m);

  assert.equal(m.tstates, 108, "Path Z T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5f55, 0x5f58, 0x5f59, 0x5f5b, 0x5f5d, // jr nz not taken -> ld e,0xfe
    0x5f60, 0x5f61, 0x5f62, 0x5f65, 0x5f67, 0x5f69, CALLER_RET,
  ], "jr nz not-taken path");
  assert.equal(m.regs.e, 0x2e, "E = (ix+0) + (-2), 0x30 + 0xfe = 0x2e");
  assert.equal(m.regs.a, 0xf8, "A = (ix+2) + 8 = 0xf8");
  assert.equal(m.regs.fC, false, "carry clear: A >= 0xe0 (off-screen)");
});

test("loc_5f53 MUTATION: `ld a,(ix+0)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5f60 ? 7 : cycles);
  seatCaller(m);
  m.regs.ix = 0x9000;
  m.mem.write8(0x881f, 0x01);
  m.mem.write8(0x9000, 0x10);
  m.mem.write8(0x9002, 0x20);

  loc_5f53(m);

  assert.equal(m.tstates, 94, "mutation loses 12 T (19 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, 106, "Path NZ T-state total"),
    /106/,
    "the 106-T golden must fail on the mutant",
  );
});
