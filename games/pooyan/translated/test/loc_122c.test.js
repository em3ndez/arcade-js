// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_122c (ROM 0x122c, Pooyan) -- the per-object state dispatcher
 * (IX -> current object record). Two ret guards, then an rst 0x28 dispatch:
 *   Guard 1 (rrca -> ret nc): record inactive when bit0 of ((ix+0)|(ix+1)) is clear.
 *   Guard 2 (cp 0x11 -> ret nc): state (ix+2)&0x1f out of range when >= 0x11.
 *   Dispatch: rst 0x28 -> loc_0028 reads inline word table at 0x123d, jp (hl) to table[state].
 *
 * Pinned paths (IX = 0x8ae0):
 *   inactive: (ix+0)=0x02,(ix+1)=0x00 -> or=0x02, rrca carry=0 -> ret nc taken.
 *     T = 19 + 19 + 4 + 11 = 53.
 *   out-of-range: (ix+0)=0x01 (bit0 set), (ix+2)=0x11 -> &0x1f=0x11, cp 0x11 => no carry -> ret.
 *     T = 19 + 19 + 4 + 5 + 19 + 7 + 7 + 11 = 91.
 *   dispatch: (ix+0)=0x01, (ix+2)=0x05 -> state 5, cp 0x11 => carry -> fall through to rst 0x28.
 *     T = 19 + 19 + 4 + 5 + 19 + 7 + 7 + 5 + 11 = 96. Stack top = 0x123d (table base), caller below.
 *
 * TEETH: mis-charge `ld a,(ix+0x00)` (19 T) as 7 T -- the golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_122c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_122c } from "../loc_122c.js";

const CALLER_RET = 0xabcd;
const IX_BASE = 0x8ae0;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x122c, pcSeq: [],
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
    call(addr, site) { this.calls.push(addr); this.site = site; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX_BASE;
}

test("loc_122c: inactive record (bit0 clear) rets via guard 1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX_BASE + 0x00, 0x02); // or (ix+1) => 0x02, bit0 = 0
  m.mem.write8(IX_BASE + 0x01, 0x00);
  loc_122c(m);

  assert.equal(m.tstates, 53, "T = 19+19+4+11(ret taken)");
  assert.deepEqual(m.pcSeq, [0x122f, 0x1232, 0x1233, CALLER_RET],
    "rrca -> ret nc taken -> back to caller");
  assert.deepEqual(m.calls, [], "no dispatch on the inactive guard");
  assert.equal(m.regs.sp, 0x8780, "ret popped the caller return -> SP back at the seat");
});

test("loc_122c: out-of-range state (>=0x11) rets via guard 2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX_BASE + 0x00, 0x01); // bit0 set -> passes guard 1
  m.mem.write8(IX_BASE + 0x01, 0x00);
  m.mem.write8(IX_BASE + 0x02, 0x11); // &0x1f = 0x11, cp 0x11 => no carry
  loc_122c(m);

  assert.equal(m.tstates, 91, "T = 19+19+4+5+19+7+7+11(ret taken)");
  assert.deepEqual(m.pcSeq, [0x122f, 0x1232, 0x1233, 0x1234, 0x1237, 0x1239, 0x123b, CALLER_RET],
    "both guards evaluated, second ret taken");
  assert.deepEqual(m.calls, [], "no dispatch when the state is out of range");
  assert.equal(m.regs.a, 0x11, "A = masked state left in the accumulator");
});

test("loc_122c: in-range state dispatches via rst 0x28 / loc_0028", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(IX_BASE + 0x00, 0x01); // bit0 set -> passes guard 1
  m.mem.write8(IX_BASE + 0x01, 0x00);
  m.mem.write8(IX_BASE + 0x02, 0x25); // &0x1f = 0x05, cp 0x11 => carry (in range)
  loc_122c(m);

  assert.equal(m.tstates, 96, "T = 19+19+4+5+19+7+7+5+11");
  assert.deepEqual(m.pcSeq, [0x122f, 0x1232, 0x1233, 0x1234, 0x1237, 0x1239, 0x123b, 0x123c, 0x0028],
    "falls through both guards to the rst target");
  assert.deepEqual(m.calls, [0x0028], "delegates to the generic dispatcher loc_0028");
  assert.equal(m.regs.a, 0x05, "A = masked state index (0x25 & 0x1f) preserved into dispatch");
  assert.equal(m.pop16(), 0x123d, "top of stack = rst return = inline table base 0x123d");
  assert.equal(m.pop16(), CALLER_RET, "beneath it = the seated caller return (no tail pushed here)");
});

test("loc_122c MUTATION: `ld a,(ix+0x00)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x122f ? 7 : cycles);
  seatCaller(m);
  m.mem.write8(IX_BASE + 0x00, 0x02);
  m.mem.write8(IX_BASE + 0x01, 0x00);
  loc_122c(m);

  assert.equal(m.tstates, 41, "mutation loses 12 T (19 -> 7): 53 - 12 = 41");
});
