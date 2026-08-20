// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5d68 (ROM 0x5d68, Pooyan) -- proximity test between a source
 * object (IX) and a target object (IY). Guards on (HL) != 0 and != 5, computes a bounding-box
 * offset from 0x881f, and on a hit re-seeds the record at (HL) then returns TWO frames up via
 * `pop af; ret` (the pop discards this routine's own return address).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_0f2b's `ret`). A
 * missing push16 before the call would then desync SP and mis-land the terminal `pop af; ret`.
 *
 * Paths: A0/A5 early ret-z guards; RETNC1 (0x881f clear branch, block-1 neg, ret nc @0x5d90);
 * RETC2 (0x881f set branch, block-2 neg, ret c @0x5d9d); RETNC2 (ret nc @0x5da0); FULL (in-range
 * hit -> re-seed + loc_0f2b + skip-return to the caller's caller). TEETH: FULL T=424 golden, and a
 * mutation charging `pop ix` at 10 T (not 14) is caught.
 *
 * Run: node --test games/pooyan/translated/test/loc_5d68.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5d68 } from "../loc_5d68.js";

const CALLER_RET = 0xabcd;
const GRAND_RET = 0x9111;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5d68, pcSeq: [],
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
    // loc_0f2b's `ret` pops the return address loc_5d68 pushed at the call site.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }
function seatCallerTwo(m) { m.regs.sp = 0x8780; m.push16(GRAND_RET); m.push16(CALLER_RET); }

test("loc_5d68 A0: (HL)==0 -> ret z at 0x5d6a", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8900;
  m.mem.write8(0x8900, 0x00);

  loc_5d68(m);

  assert.equal(m.tstates, 7 + 4 + 11);
  assert.deepEqual(m.pcSeq, [0x5d69, 0x5d6a, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
});

test("loc_5d68 A5: (HL)==5 -> ret z at 0x5d6d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8900;
  m.mem.write8(0x8900, 0x05);

  loc_5d68(m);

  assert.equal(m.tstates, 7 + 4 + 5 + 7 + 11);
  assert.deepEqual(m.pcSeq, [0x5d69, 0x5d6a, 0x5d6b, 0x5d6d, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5d68 RETNC1: 0x881f clear, block-1 neg, ret nc at 0x5d90", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8900;
  m.regs.ix = 0x8840;
  m.regs.iy = 0x887c;
  m.mem.write8(0x8900, 0x01); // (HL) != 0,5
  m.mem.write8(0x881f, 0x00); // jr nz not taken -> E=5, D=0x10
  // ix0=0, ix2=0, iy0=0 (defaults): dx = |0 - 5| = 5 >= 4 -> ret nc

  loc_5d68(m);

  assert.equal(m.tstates, 190);
  assert.deepEqual(m.pcSeq, [
    0x5d69, 0x5d6a, 0x5d6b, 0x5d6d, 0x5d6e, 0x5d70, 0x5d72, 0x5d75, 0x5d76, 0x5d78,
    0x5d7a, 0x5d7c, 0x5d7f, 0x5d80, 0x5d81, 0x5d84, 0x5d85, 0x5d86, 0x5d89, 0x5d8a,
    0x5d8c, 0x5d8e, 0x5d90, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
});

test("loc_5d68 RETC2: 0x881f set, block-2 neg, ret c at 0x5d9d", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8900;
  m.regs.ix = 0x8840;
  m.regs.iy = 0x887c;
  m.mem.write8(0x8900, 0x02);
  m.mem.write8(0x881f, 0x01); // jr nz taken -> E=0xfc, D=0x00
  m.mem.write8(0x8840, 0x10); // ix0 -> E = 0x10+0xfc = 0x0c
  m.mem.write8(0x8842, 0x20); // ix2 -> D = 0x20
  m.mem.write8(0x887c, 0x0e); // iy0 -> dx = |0x0e-0x0c| = 2 < 4
  m.mem.write8(0x887e, 0x13); // iy2 -> dy = |(0x13+8)-0x20| = |-5| = 5 < 9 -> ret c

  loc_5d68(m);

  assert.equal(m.tstates, 235);
  assert.deepEqual(m.pcSeq, [
    0x5d69, 0x5d6a, 0x5d6b, 0x5d6d, 0x5d6e, 0x5d70, 0x5d72, 0x5d75, 0x5d76, 0x5d7c,
    0x5d7f, 0x5d80, 0x5d81, 0x5d84, 0x5d85, 0x5d86, 0x5d89, 0x5d8a, 0x5d8e, 0x5d90,
    0x5d91, 0x5d94, 0x5d96, 0x5d97, 0x5d99, 0x5d9b, 0x5d9d, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
});

test("loc_5d68 RETNC2: block-2 no neg, ret nc at 0x5da0", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8900;
  m.regs.ix = 0x8840;
  m.regs.iy = 0x887c;
  m.mem.write8(0x8900, 0x02);
  m.mem.write8(0x881f, 0x01);
  m.mem.write8(0x8840, 0x10);
  m.mem.write8(0x8842, 0x20);
  m.mem.write8(0x887c, 0x0e); // dx = 2 < 4
  m.mem.write8(0x887e, 0x30); // dy = (0x30+8)-0x20 = 0x18 = 24 >= 0x0f -> ret nc

  loc_5d68(m);

  assert.equal(m.tstates, 244);
  assert.deepEqual(m.pcSeq, [
    0x5d69, 0x5d6a, 0x5d6b, 0x5d6d, 0x5d6e, 0x5d70, 0x5d72, 0x5d75, 0x5d76, 0x5d7c,
    0x5d7f, 0x5d80, 0x5d81, 0x5d84, 0x5d85, 0x5d86, 0x5d89, 0x5d8a, 0x5d8e, 0x5d90,
    0x5d91, 0x5d94, 0x5d96, 0x5d97, 0x5d9b, 0x5d9d, 0x5d9e, 0x5da0, CALLER_RET,
  ]);
  assert.equal(m.pc, CALLER_RET);
});

test("loc_5d68 FULL: in-range hit -> re-seed record + loc_0f2b + skip-return", () => {
  const m = makeMachine();
  seatCallerTwo(m);
  m.regs.hl = 0x9000; // record base (also IX after pop ix)
  m.regs.ix = 0x8840; // source object
  m.regs.iy = 0x887c; // target object
  m.mem.write8(0x9000, 0x01); // (HL) != 0,5
  m.mem.write8(0x881f, 0x01); // E=0xfc, D=0x00
  m.mem.write8(0x8840, 0x10); // ix0 -> E=0x0c
  m.mem.write8(0x8842, 0x20); // ix2 -> D=0x20
  m.mem.write8(0x887c, 0x0e); // iy0 -> dx=2 < 4
  m.mem.write8(0x887e, 0x24); // iy2 -> dy = (0x24+8)-0x20 = 0x0c in [9,0x0f)

  loc_5d68(m);

  assert.equal(m.tstates, 424, "FULL path T-state total");
  assert.deepEqual(m.pcSeq, [
    0x5d69, 0x5d6a, 0x5d6b, 0x5d6d, 0x5d6e, 0x5d70, 0x5d72, 0x5d75, 0x5d76, 0x5d7c,
    0x5d7f, 0x5d80, 0x5d81, 0x5d84, 0x5d85, 0x5d86, 0x5d89, 0x5d8a, 0x5d8e, 0x5d90,
    0x5d91, 0x5d94, 0x5d96, 0x5d97, 0x5d9b, 0x5d9d, 0x5d9e, 0x5da0, 0x5da1, 0x5da2,
    0x5da4, 0x5da8, 0x5dac, 0x5db0, 0x5db4, 0x5db7, 0x5dba, 0x5dbd, 0x0f2b, 0x5dc1,
    GRAND_RET,
  ], "pcSeq visits the call target 0x0f2b, then pop af (0x5dc1), then the grand-caller");
  assert.deepEqual(m.calls, [0x0f2b], "one call to loc_0f2b");
  // record re-seed (IX = 0x9000 after pop ix)
  assert.equal(m.mem.read8(0x9000), 0x00, "(ix+0) cleared");
  assert.equal(m.mem.read8(0x9001), 0x01, "(ix+1) = 1");
  assert.equal(m.mem.read8(0x9002), 0x0c, "(ix+2) = 0x0c");
  assert.equal(m.mem.read8(0x9007), 0x01, "(ix+7) = 1");
  assert.equal(m.mem.read8(0x9013), 0x5d, "(ix+0x13) = high(0x5dc2)");
  assert.equal(m.mem.read8(0x9012), 0xc2, "(ix+0x12) = low(0x5dc2)");
  // skip-return: pop af consumed CALLER_RET, ret landed on GRAND_RET, stack fully unwound
  assert.equal(m.pc, GRAND_RET, "ret returns to the caller's caller");
  assert.equal(m.regs.a, (CALLER_RET >> 8) & 0xff, "pop af discarded loc_5d68's own return address");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_5d68 MUTATION: `pop ix` mis-charged 10 T (not 14) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x5da4 ? 10 : cycles);
  seatCallerTwo(m);
  m.regs.hl = 0x9000;
  m.regs.ix = 0x8840;
  m.regs.iy = 0x887c;
  m.mem.write8(0x9000, 0x01);
  m.mem.write8(0x881f, 0x01);
  m.mem.write8(0x8840, 0x10);
  m.mem.write8(0x8842, 0x20);
  m.mem.write8(0x887c, 0x0e);
  m.mem.write8(0x887e, 0x24);

  loc_5d68(m);

  assert.equal(m.tstates, 420, "mutation loses 4 T (14 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 424, "FULL path T-state total"), /424/);
});
