// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for translated loc_338a (ROM 0x338a-0x339a, Pooyan) -- a state dispatcher.
 * Guards: (ix+0)|(ix+1) must have bit0 set (rrca; ret nc) and (ix+2)&0x1f must be < 0x11
 * (and 0x1f; cp 0x11; ret nc). When both hold, `rst 0x28` pushes the inline table base 0x339b and
 * tail-dispatches through loc_0028; the selected handler ret's to loc_338a's caller.
 *
 * The mock's `call(0x0028)` POPS once -- modelling loc_0028's `pop hl` consuming the table base
 * that the rst pushed. So a MISSING push16(0x339b) would make that pop consume the seated caller
 * return instead, desyncing SP -- the DISPATCH stack tooth (SP == 0x877e, caller still seated).
 *
 * Paths: RETNC1 (bit0 of the OR clear -> ret nc at 0x3391); RETNC2 (index >= 0x11 -> ret nc at
 * 0x3399); DISPATCH (both guards pass -> rst 0x28 -> loc_0028). TEETH: mis-charge `or (ix+1)`
 * (19 T) as 15 T -> the 96-T golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_338a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_338a } from "../loc_338a.js";

const CALLER_RET = 0xabcd;
const IX = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x338a, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // loc_0028 pops the inline table base (the rst-pushed return) then jp (hl)'s to the handler;
    // model that single pop so a missing push16(0x339b) desyncs SP.
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_338a RETNC1: bit0 of (ix+0)|(ix+1) clear -> ret nc at 0x3391", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0, 0x00);
  m.mem.write8(IX + 1, 0x00); // OR == 0 -> rrca carry clear -> ret nc

  loc_338a(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 11, "T = ld a,(ix) + or (ix) + rrca + ret nc");
  assert.deepEqual(m.pcSeq, [0x338d, 0x3390, 0x3391, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, [], "no dispatch");
});

test("loc_338a RETNC2: (ix+2)&0x1f >= 0x11 -> ret nc at 0x3399", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0, 0x01); // OR bit0 set -> first ret nc not taken
  m.mem.write8(IX + 1, 0x00);
  m.mem.write8(IX + 2, 0x11); // &0x1f = 0x11, cp 0x11 -> carry clear -> ret nc

  loc_338a(m);

  assert.equal(m.tstates, 19 + 19 + 4 + 5 + 19 + 7 + 7 + 11, "T through the second ret nc");
  assert.deepEqual(m.pcSeq, [0x338d, 0x3390, 0x3391, 0x3392, 0x3395, 0x3397, 0x3399, CALLER_RET]);
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
});

test("loc_338a DISPATCH: both guards pass -> rst 0x28 -> loc_0028 (table base popped)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0, 0x01); // OR bit0 set
  m.mem.write8(IX + 1, 0x00);
  m.mem.write8(IX + 2, 0x05); // &0x1f = 5 (< 0x11) -> index 5

  loc_338a(m);

  assert.equal(m.tstates, 96, "DISPATCH T-state total (through rst 0x28)");
  assert.deepEqual(m.pcSeq,
    [0x338d, 0x3390, 0x3391, 0x3392, 0x3395, 0x3397, 0x3399, 0x339a, 0x0028],
    "the rst steps to the loc_0028 trampoline");
  assert.equal(m.pc, 0x0028, "rst 0x28 transfers control to loc_0028");
  assert.deepEqual(m.calls, [0x0028], "tail-dispatched via loc_0028");
  assert.equal(m.regs.a, 0x05, "A = (ix+2)&0x1f = table index");
  // rst pushed 0x339b (top), loc_0028's pop hl consumed it -> SP back at the seated baseline
  // with the caller return still on the stack (the handler will ret into it, outside this routine).
  assert.equal(m.regs.sp, 0x877e, "table base popped; caller return still seated");
  assert.equal(m.mem.read16(0x877e), CALLER_RET, "seated caller return preserved");
});

test("loc_338a MUTATION: `or (ix+1)` mis-charged 15T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x3390 ? 15 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0, 0x01);
  m.mem.write8(IX + 1, 0x00);
  m.mem.write8(IX + 2, 0x05);

  loc_338a(m);

  assert.equal(m.tstates, 92, "mutation loses 4 T (19 -> 15)");
  assert.throws(
    () => assert.equal(m.tstates, 96, "DISPATCH T-state total"),
    /96/,
    "the 96-T golden must fail on the mutant",
  );
});
