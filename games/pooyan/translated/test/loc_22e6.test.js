// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_22e6 (Pooyan ROM 0x22e6-0x2324) -- the per-actor animation
 * script stepper. (ix+0x0e) is a frame countdown; at zero it pulls the next 3-byte entry from the
 * cursor (0x8f00) and advances it. A 0xff lead byte is a control marker: call 0x22d0 tallies a flag
 * pair, then the marker resolves to a reset (tally==3) or an inline 2-byte cursor (both loop back).
 *
 * The mock's `call` POPS the return address the call site pushed (modelling 0x22d0's `ret`); 0x22d0
 * preserves HL and returns a value in A, which the mock supplies via `m.a22d0`. A missing push16 at
 * the call site desyncs the stack -- the final `ret` then lands on garbage instead of CALLER_RET.
 *
 * Paths: COUNTDOWN ((ix+0x0e)!=0 -> dec + ret, 63 T); REALENTRY (cursor -> a live entry, 187 T);
 * MARKER (0xff -> call 0x22d0 returns !=3 -> inline cursor -> loop -> live entry, 329 T, exercises
 * the 0x22d0 push16 + loop-back). TEETH: mis-charge `dec (ix+0x0e)` (DD 35 = 23 T) as 11 T.
 *
 * Run: node --test games/pooyan/translated/test/loc_22e6.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_22e6 } from "../loc_22e6.js";

const CALLER_RET = 0xabcd;
const IX = 0x8a80;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x22e6, pcSeq: [], a22d0: 0x00,
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
    // Model the callee's `ret` popping the return address the call site pushed. loc_22d0 leaves HL
    // untouched and returns a byte in A (the doubled-bit flag tally) -- supplied via m.a22d0.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x22d0) regs.a = this.a22d0 & 0xff;
      return undefined;
    },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_22e6 COUNTDOWN: (ix+0x0e)!=0 -> decrement and return", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0e, 0x05);

  loc_22e6(m);

  assert.equal(m.tstates, 63, "COUNTDOWN T = ld(19)+and(4)+jr(7)+dec(23)+ret(10)");
  assert.deepEqual(m.pcSeq, [0x22e9, 0x22ea, 0x22ec, 0x22ef, CALLER_RET]);
  assert.equal(m.mem.read8(IX + 0x0e), 0x04, "countdown decremented");
  assert.deepEqual(m.calls, [], "no 0x22d0 call on the countdown path");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound to baseline");
});

test("loc_22e6 REALENTRY: countdown at 0 -> pull a live 3-byte entry", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0e, 0x00);
  m.mem.write16(0x8f00, 0x2700); // script cursor
  m.mem.write8(0x2700, 0x20);    // tile
  m.mem.write8(0x2701, 0x30);    // colour
  m.mem.write8(0x2702, 0x08);    // delay

  loc_22e6(m);

  assert.equal(m.tstates, 187, "REALENTRY T-state total");
  assert.deepEqual(m.pcSeq, [
    0x22e9, 0x22ea, 0x22f0,
    0x22f3, 0x22f4, 0x22f6, 0x22f8,
    0x22fb, 0x22fc, 0x22fd, 0x2300, 0x2301, 0x2302, 0x2305, 0x2306, 0x2309,
    CALLER_RET,
  ]);
  assert.equal(m.mem.read8(IX + 0x10), 0x20, "tile -> (ix+0x10)");
  assert.equal(m.mem.read8(IX + 0x0f), 0x30, "colour -> (ix+0x0f)");
  assert.equal(m.mem.read8(IX + 0x0e), 0x08, "delay -> (ix+0x0e)");
  assert.equal(m.mem.read16(0x8f00), 0x2703, "cursor advanced past the 3-byte entry");
  assert.deepEqual(m.calls, []);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_22e6 MARKER: 0xff -> call 0x22d0 (!=3) -> inline cursor -> loop -> live entry", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.a22d0 = 0x00; // tally != 3 -> jr nz to the inline-cursor path
  m.mem.write8(IX + 0x0e, 0x00);
  m.mem.write16(0x8f00, 0x2800); // cursor at the 0xff marker
  m.mem.write8(0x2800, 0xff);    // control marker
  m.mem.write8(0x2801, 0x50);    // inline cursor low
  m.mem.write8(0x2802, 0x28);    // inline cursor high -> 0x2850
  m.mem.write8(0x2850, 0x11);    // live entry: tile
  m.mem.write8(0x2851, 0x22);    // colour
  m.mem.write8(0x2852, 0x33);    // delay

  loc_22e6(m);

  assert.equal(m.tstates, 329, "MARKER T-state total");
  assert.deepEqual(m.pcSeq, [
    0x22e9, 0x22ea, 0x22f0,
    0x22f3, 0x22f4, 0x22f6, 0x230a,
    0x22d0,                                   // call 0x22d0 -> target
    0x230f, 0x2319,                           // cp 3 -> jr nz to inline cursor
    0x231a, 0x231b, 0x231e, 0x231f, 0x2320, 0x2323, 0x22f0, // 2-byte cursor + loop back
    0x22f3, 0x22f4, 0x22f6, 0x22f8,           // re-read: live entry
    0x22fb, 0x22fc, 0x22fd, 0x2300, 0x2301, 0x2302, 0x2305, 0x2306, 0x2309,
    CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x22d0], "one 0x22d0 tally call");
  assert.equal(m.mem.read8(IX + 0x10), 0x11, "tile from the redirected entry");
  assert.equal(m.mem.read8(IX + 0x0f), 0x22, "colour from the redirected entry");
  assert.equal(m.mem.read8(IX + 0x0e), 0x33, "delay from the redirected entry");
  assert.equal(m.mem.read16(0x8f00), 0x2853, "cursor advanced past the live entry");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780, "stack unwound -- the 0x22d0 push16 matched its ret pop");
});

test("loc_22e6 MUTATION: `dec (ix+0x0e)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x22ef ? 11 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8(IX + 0x0e, 0x05);

  loc_22e6(m);

  assert.equal(m.tstates, 51, "mutation loses 12 T (23 -> 11)");
  assert.throws(() => assert.equal(m.tstates, 63, "COUNTDOWN T"), /COUNTDOWN/);
});
