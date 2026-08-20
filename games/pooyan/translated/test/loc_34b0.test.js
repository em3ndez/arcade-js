// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_34b0 (ROM 0x34b0, Pooyan) -- the shared movement tail that
 * loc_343e and loc_34f2 jp into. It blanks the sprite band (call loc_3553), decrements the
 * 0x8d40 / 0x8901 counters, then renders the depth into two HUD tiles at 0x8743 / 0x8763,
 * converting depth >= 0x0a to packed BCD via the inline 0x34dd loop (guarded by 0x8f50).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling loc_3553's `ret`),
 * so a missing push16 at 0x34b0 desyncs the stack and the SP-baseline tooth fails.
 *
 * Paths: BCD (C!=0 dec, 0x880a==4 inc, depth 0x10 -> BCD loop 16x -> tail digits, ret 0x34f1),
 * SMALL (C==0, 0x880a!=4, depth 0 < 0x0a -> ret z 0x34ef), GUARD (depth>=0x0a, 0x8f50!=0 ->
 * ret nz 0x34db). TEETH: `add hl,de` (11T) mis-charged 7T is caught by the BCD golden.
 *
 * Run: node --test games/pooyan/translated/test/loc_34b0.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_34b0 } from "../loc_34b0.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x34b0, pcSeq: [],
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
    // The callee's `ret` pops the return address the call site pushed -- model that pop so a
    // missing push16 desyncs SP and fails the balance tooth. loc_3553 clobbers only regs loc_34b0 reloads.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_34b0 BCD: depth 0x10 -> BCD digits 1,6 at 0x8743/0x8763, ret 0x34f1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x11);  // C=0x11 (!=0) -> dec (0x8901) -> 0x10
  m.mem.write8(0x880a, 0x04);  // == 4 -> inc l + inc (0x8902)
  m.mem.write8(0x8f50, 0x00);  // guard clear -> no ret nz
  m.mem.write8(0x8d40, 0x05);  // dec -> 0x04
  m.mem.write8(0x8902, 0x00);  // inc -> 0x01

  loc_34b0(m);

  const loop = [];
  for (let i = 0; i < 16; i++) loop.push(0x34df, 0x34e0, i < 15 ? 0x34dd : 0x34e2);
  const PC_BCD = [
    0x3553, 0x34b6, 0x34b7, 0x34ba, 0x34bb, 0x34bc, 0x34bd, 0x34bf, 0x34c0,
    0x34c3, 0x34c5, 0x34c7, 0x34c8, 0x34c9, 0x34cc, 0x34cd, 0x34d0, 0x34d3, 0x34d5,
    0x34d7, 0x34da, 0x34db, 0x34dc, 0x34dd,
    ...loop, 0x34e3,
    0x34e5, 0x34e6, 0x34e7, 0x34e8, 0x34e9, 0x34ea, 0x34eb, 0x34ec, 0x34ee, 0x34ef, 0x34f0, 0x34f1,
    CALLER_RET,
  ];
  assert.deepEqual(m.pcSeq, PC_BCD, "BCD path step boundaries");
  assert.equal(m.tstates, 661, "BCD path T-state total");
  assert.equal(m.pc, CALLER_RET, "ret 0x34f1 to seated caller");
  assert.deepEqual(m.calls, [0x3553], "one blank-band call");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound (push16 matched loc_3553 ret)");
  assert.equal(m.mem.read8(0x8901), 0x10, "depth decremented");
  assert.equal(m.mem.read8(0x8902), 0x01, "0x8902 incremented (0x880a==4)");
  assert.equal(m.mem.read8(0x8d40), 0x04, "spawn counter decremented");
  assert.equal(m.mem.read8(0x8743), 0x06, "low BCD digit tile");
  assert.equal(m.mem.read8(0x8763), 0x01, "high BCD digit tile");
});

test("loc_34b0 SMALL: depth 0 < 0x0a -> ret z at 0x34ef, high tile untouched", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x00);  // C==0 -> skip dec
  m.mem.write8(0x880a, 0x00);  // != 4 -> jr nz taken
  m.mem.write8(0x8d40, 0x05);
  m.mem.write8(0x8763, 0xee);  // sentinel: ret z must NOT write it

  loc_34b0(m);

  assert.deepEqual(m.pcSeq, [
    0x3553, 0x34b6, 0x34b7, 0x34ba, 0x34bb, 0x34bc, 0x34bd, 0x34c0,
    0x34c3, 0x34c5, 0x34c9, 0x34cc, 0x34cd, 0x34d0, 0x34d3, 0x34d5, 0x34e3,
    0x34e5, 0x34e6, 0x34e7, 0x34e8, 0x34e9, 0x34ea, 0x34eb, 0x34ec, 0x34ee, 0x34ef,
    CALLER_RET,
  ], "SMALL path step boundaries");
  assert.equal(m.tstates, 230, "SMALL path T-state total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.equal(m.mem.read8(0x8743), 0x00, "low tile = 0");
  assert.equal(m.mem.read8(0x8763), 0xee, "high tile untouched (ret z)");
});

test("loc_34b0 GUARD: depth>=0x0a and 0x8f50!=0 -> ret nz at 0x34db", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8901, 0x0c);  // C!=0 -> dec -> 0x0b (>= 0x0a)
  m.mem.write8(0x880a, 0x00);  // != 4 -> jr nz taken
  m.mem.write8(0x8f50, 0x01);  // guard set -> ret nz
  m.mem.write8(0x8743, 0xee);  // sentinel: ret nz must NOT reach the render writes

  loc_34b0(m);

  assert.deepEqual(m.pcSeq, [
    0x3553, 0x34b6, 0x34b7, 0x34ba, 0x34bb, 0x34bc, 0x34bd, 0x34bf, 0x34c0,
    0x34c3, 0x34c5, 0x34c9, 0x34cc, 0x34cd, 0x34d0, 0x34d3, 0x34d5, 0x34d7, 0x34da, 0x34db,
    CALLER_RET,
  ], "GUARD path step boundaries");
  assert.equal(m.tstates, 192, "GUARD path T-state total");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
  assert.equal(m.mem.read8(0x8743), 0xee, "render writes skipped");
});

test("loc_34b0 MUTATION: `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x34e7 ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(0x8901, 0x11);
  m.mem.write8(0x880a, 0x04);
  m.mem.write8(0x8f50, 0x00);

  loc_34b0(m);

  assert.equal(m.tstates, 657, "mutation loses 4 T (11 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 661, "BCD golden"), /661/,
    "the 661-T golden must fail on the mutant");
});
