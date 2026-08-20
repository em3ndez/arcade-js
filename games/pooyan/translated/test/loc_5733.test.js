// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_5733 (ROM 0x5733, Pooyan) -- spawn-an-actor entry (the body of
 * loc_572b without its "slot live?" prologue). Inits the IX slot, computes a clamped/level-shifted
 * column index in C (optionally biased via loc_57b4), looks up two byte tables via rst 0x20, sets
 * the animation (loc_381e) + start-of-scan state (loc_57c3), then `pop af` discards its own return
 * address and `ret`s ONE frame up.
 *
 * SKIP-RETURN: two returns are seated -- CALLER_RET (this routine's own, popped by `pop af`) above
 * GRAND_RET (the frame it actually returns to). Every intermediate call is stack-balanced by the
 * mock's popping `call`, so at `pop af` the top is still CALLER_RET; the final `ret` lands on
 * GRAND_RET and SP is back to the pre-seat baseline. A call site missing its push16 would leave the
 * `pop af` reading a stray value and `ret` landing on the wrong frame -- the stack tooth.
 *
 * Path P1 (0x8907 bit0=1: hl=0x58e0, NO loc_57b4, hl=0x589b; all three jr c taken): T=576.
 * Path P0 (0x8907 bit0=0: hl=0x5902, CALL loc_57b4, hl=0x58c0; all three jr c NOT taken, 0x8d4c
 * bias applied): T=613. Between them every fork takes both outcomes.
 * TEETH: `bit 0,a` (8 T) mis-charged 4 T -> the 576-T golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_5733.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_5733 } from "../loc_5733.js";

const CALLER_RET = 0xabcd; // this routine's own return address -- discarded by `pop af`
const GRAND_RET = 0x1234;  // the frame the final `ret` returns to

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x5733, pcSeq: [],
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
    // Pop the pushed return (models the callee's ret). rst 0x20 -> loc_0020: HL += A (16-bit), A=(HL).
    // loc_57b4/loc_381e/loc_57c3 are stack-neutral here (their register effects are not modelled --
    // the test does not depend on them).
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x0020) { regs.hl = (regs.hl + regs.a) & 0xffff; regs.a = mem.read8(regs.hl); }
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(GRAND_RET);   // lower on the stack
  m.push16(CALLER_RET);  // on top -- popped by `pop af`
}

const PC_P1 = [
  0x5734, 0x5738, 0x573c, 0x573f, 0x5740, 0x5743, 0x5746, 0x5749, 0x574c, 0x5750, 0x5753,
  0x5756, 0x5759, 0x575b,
  0x5760,                    // jr nz taken (bit0 set) -> hl stays 0x58e0
  0x5763, 0x5765,
  0x5769,                    // jr c taken (0x8820 < 3)
  0x576a, 0x576d, 0x576f,
  0x5776,                    // jr c taken (0x8908 < 4) -> skip bias
  0x5779, 0x577b,
  0x577e,                    // call z NOT taken (bit0 set)
  0x5781, 0x5782, 0x5783, 0x5785,
  0x5789,                    // jr c taken (C < 0x20)
  0x578a,
  0x0020,                    // rst 0x20 -> target
  0x578e, 0x5790, 0x5793, 0x5796,
  0x381e,                    // call loc_381e -> target
  0x579c, 0x579f, 0x57a1,
  0x57a6,                    // jr nz taken (bit0 set) -> hl stays 0x589b
  0x57a7,
  0x0020,                    // rst 0x20 -> target
  0x57ab, 0x57ae, 0x57af,
  0x57c3,                    // call loc_57c3 -> target
  0x57b3,                    // pop af -> next
  GRAND_RET,                 // ret -> grandparent frame
];

test("loc_5733 Path P1: 0x8907 bit0=1, no loc_57b4, jr c all taken -> skip-return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8ae0;
  m.regs.c = 0x55;
  m.regs.de = 0x0042; // E=0x42 -> (ix+0x04)
  m.mem.write8(0x8907, 0x01); // bit0 set
  m.mem.write8(0x8820, 0x00); // < 3 -> jr c taken
  m.mem.write8(0x8908, 0x00); // < 4 -> jr c taken, no 0x8d4c bias
  m.mem.write8(0x58e1, 0x08); // table[0x58e0 + 1]
  m.mem.write8(0x589c, 0x20); // table[0x589b + 1]
  m.mem.write8(0x8d40, 0x05); // scan counter

  loc_5733(m);

  assert.equal(m.tstates, 576, "Path P1 T-state total");
  assert.deepEqual(m.pcSeq, PC_P1, "step boundaries match the ROM bytes");
  assert.equal(m.pc, GRAND_RET, "skip-return lands on the grandparent frame");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound past both seated returns");
  assert.deepEqual(m.calls, [0x0020, 0x381e, 0x0020, 0x57c3], "no loc_57b4 (call z not taken)");
  // slot init
  assert.equal(m.mem.read8(0x8ae0 + 0x00), 0x01, "(ix+0)=1");
  assert.equal(m.mem.read8(0x8ae0 + 0x02), 0x03, "(ix+2)=3");
  assert.equal(m.mem.read8(0x8ae0 + 0x04), 0x42, "(ix+4)=E");
  assert.equal(m.mem.read8(0x8ae0 + 0x03), 0x00, "(ix+3)=0");
  assert.equal(m.mem.read8(0x8ae0 + 0x07), 0x01, "(ix+7)=1");
  assert.equal(m.mem.read8(0x8ae0 + 0x0b), 0x00, "(ix+0x0b)=0");
  // rst 0x20 #1: index C=1 into 0x58e0 -> 0x08 into (ix+9), neg -> (ix+0x0a)
  assert.equal(m.mem.read8(0x8ae0 + 0x09), 0x08, "(ix+9)=table byte");
  assert.equal(m.mem.read8(0x8ae0 + 0x0a), (0x100 - 0x08) & 0xff, "(ix+0x0a)=neg(byte)");
  // rst 0x20 #2 -> 0x8d07 ; scan counter bumped
  assert.equal(m.mem.read8(0x8d07), 0x20, "(0x8d07)=table byte #2");
  assert.equal(m.mem.read8(0x8d40), 0x06, "scan counter incremented");
});

const PC_P0 = [
  0x5734, 0x5738, 0x573c, 0x573f, 0x5740, 0x5743, 0x5746, 0x5749, 0x574c, 0x5750, 0x5753,
  0x5756, 0x5759, 0x575b,
  0x575d, 0x5760,            // jr nz NOT taken -> hl=0x5902
  0x5763, 0x5765,
  0x5767, 0x5769,            // jr c NOT taken (0x8820 >= 3) -> A=0x03
  0x576a, 0x576d, 0x576f,
  0x5771, 0x5774, 0x5775, 0x5776, // jr c NOT taken (0x8908 >= 4) -> 0x8d4c bias
  0x5779, 0x577b,
  0x57b4,                    // call z TAKEN -> loc_57b4
  0x5781, 0x5782, 0x5783, 0x5785,
  0x5787, 0x5789,            // jr c NOT taken (C >= 0x20) -> A=0x1f
  0x578a,
  0x0020,                    // rst 0x20 -> target
  0x578e, 0x5790, 0x5793, 0x5796,
  0x381e,                    // call loc_381e -> target
  0x579c, 0x579f, 0x57a1,
  0x57a3, 0x57a6,            // jr nz NOT taken -> hl=0x58c0
  0x57a7,
  0x0020,                    // rst 0x20 -> target
  0x57ab, 0x57ae, 0x57af,
  0x57c3,                    // call loc_57c3 -> target
  0x57b3,
  GRAND_RET,
];

test("loc_5733 Path P0: 0x8907 bit0=0, calls loc_57b4, jr c all NOT taken -> skip-return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = 0x8ae0;
  m.regs.c = 0x55;
  m.regs.de = 0x0042;
  m.mem.write8(0x8907, 0x00); // bit0 clear
  m.mem.write8(0x8820, 0x05); // >= 3 -> jr c not taken -> A=0x03
  m.mem.write8(0x8908, 0x05); // >= 4 -> jr c not taken -> apply 0x8d4c bias
  m.mem.write8(0x8d4c, 0x30); // bias: C = 0x30 + 0x03 = 0x33 (>= 0x20)
  m.mem.write8(0x5921, 0x0c); // table[0x5902 + 0x1f]
  m.mem.write8(0x58df, 0x18); // table[0x58c0 + 0x1f]
  m.mem.write8(0x8d40, 0x00); // scan counter

  loc_5733(m);

  assert.equal(m.tstates, 613, "Path P0 T-state total");
  assert.deepEqual(m.pcSeq, PC_P0, "step boundaries match the ROM bytes");
  assert.equal(m.pc, GRAND_RET, "skip-return lands on the grandparent frame");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound past both seated returns");
  assert.deepEqual(m.calls, [0x57b4, 0x0020, 0x381e, 0x0020, 0x57c3], "loc_57b4 called (call z taken)");
  assert.equal(m.mem.read8(0x8ae0 + 0x09), 0x0c, "(ix+9)=table byte (index 0x1f into 0x5902)");
  assert.equal(m.mem.read8(0x8ae0 + 0x0a), (0x100 - 0x0c) & 0xff, "(ix+0x0a)=neg(byte)");
  assert.equal(m.mem.read8(0x8d07), 0x18, "(0x8d07)=table byte #2 (into 0x58c0)");
  assert.equal(m.mem.read8(0x8d40), 0x01, "scan counter incremented");
});

test("loc_5733 MUTATION: `bit 0,a` mis-charged 4 T (not 8 T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x577b ? 4 : cycles);
  seatCaller(m);
  m.regs.ix = 0x8ae0;
  m.regs.c = 0x55;
  m.regs.de = 0x0042;
  m.mem.write8(0x8907, 0x01);
  m.mem.write8(0x8820, 0x00);
  m.mem.write8(0x8908, 0x00);
  m.mem.write8(0x58e1, 0x08);
  m.mem.write8(0x589c, 0x20);
  m.mem.write8(0x8d40, 0x05);

  loc_5733(m);

  assert.equal(m.tstates, 572, "mutation loses 4 T (8 -> 4)");
  assert.throws(() => assert.equal(m.tstates, 576, "Path P1 T-state total"), /576/);
});
