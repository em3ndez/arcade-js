// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_125f (ROM 0x125f-0x126f, Pooyan) -- countdown-driven state
 * transition for the object at IX. It decrements the timer (ix+0x11). While the result is non-zero
 * it `ret nz`'s to the caller (no state change). On the tick it reaches zero it advances the phase
 * field (ix+0x02), sets DE=0x3838 and (ix+0x08)=1, then tail-jumps into 0x381e (whose ret is ours).
 *
 * The mock's `call` POPS the return the call site pushed (models the callee's `ret`); the tail jp
 * pushes NOTHING, so call(0x381e) consumes the seated caller return -- SP must land at the pre-seat
 * baseline (0x8780) on every path.
 *
 * Pinned paths:
 *   timer NOT expired ((ix+0x11)=2 -> dec=1, NZ): ret nz.
 *     T = 23 (dec (ix+d)) + 11 (ret cc taken) = 34. No calls. (ix+0x11) left at 1.
 *   timer EXPIRES ((ix+0x11)=1 -> dec=0, Z): fall through, tail-jp 0x381e.
 *     T = 23 + 5 (ret nt) + 23 (inc (ix+d)) + 10 (ld de,nn) + 19 (ld (ix+d),n) + 10 (jp) = 90.
 *     (ix+0x02) incremented, DE=0x3838, (ix+0x08)=1, delegates to 0x381e.
 *
 * TEETH: mis-charge `dec (ix+0x11)` (23 T) as 19 T -- the 90-T expiry golden must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_125f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_125f } from "../loc_125f.js";

const CALLER_RET = 0xabcd;
const IX = 0xa000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x125f, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // A callee's `ret` pops the return the call site pushed; the tail jp pushes nothing, so this
    // consumes the seated caller return (loc_381e's ret goes to loc_125f's caller).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.ix = IX;
}

test("loc_125f: timer not expired ((ix+0x11)=2) -> dec to 1, ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8((IX + 0x11) & 0xffff, 0x02);
  m.mem.write8((IX + 0x02) & 0xffff, 0x55); // phase must NOT change on this path
  loc_125f(m);

  assert.equal(m.tstates, 34, "T = 23 (dec (ix+d)) + 11 (ret cc taken)");
  assert.deepEqual(m.pcSeq, [0x1262, CALLER_RET], "dec, then ret nz to the seated caller");
  assert.deepEqual(m.calls, [], "no delegation on the non-expired path");
  assert.equal(m.mem.read8((IX + 0x11) & 0xffff), 0x01, "timer decremented to 1");
  assert.equal(m.mem.read8((IX + 0x02) & 0xffff), 0x55, "phase (ix+0x02) untouched");
  assert.equal(m.regs.sp, 0x8780, "SP back at the pre-seat baseline");
});

test("loc_125f: timer expires ((ix+0x11)=1) -> dec to 0, advance + tail-jp 0x381e", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8((IX + 0x11) & 0xffff, 0x01);
  m.mem.write8((IX + 0x02) & 0xffff, 0x07);
  m.mem.write8((IX + 0x08) & 0xffff, 0x00);
  loc_125f(m);

  assert.equal(m.tstates, 90, "T = 23 + 5(ret nt) + 23(inc) + 10(ld de) + 19(ld (ix+d),n) + 10(jp)");
  assert.deepEqual(m.pcSeq, [0x1262, 0x1263, 0x1266, 0x1269, 0x126d, 0x381e],
    "falls through the ret, advances, then tail-jumps to 0x381e");
  assert.deepEqual(m.calls, [0x381e], "tail-delegates to loc_381e");
  assert.equal(m.mem.read8((IX + 0x11) & 0xffff), 0x00, "timer hit zero");
  assert.equal(m.mem.read8((IX + 0x02) & 0xffff), 0x08, "phase (ix+0x02) advanced 0x07 -> 0x08");
  assert.equal(m.regs.de, 0x3838, "DE = 0x3838 handed to loc_381e");
  assert.equal(m.mem.read8((IX + 0x08) & 0xffff), 0x01, "(ix+0x08) set to 1");
  assert.equal(m.regs.sp, 0x8780, "tail jp: loc_381e's ret consumes the caller return, SP balanced");
});

test("loc_125f MUTATION: `dec (ix+0x11)` mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1262 ? 19 : cycles);
  seatCaller(m);
  m.mem.write8((IX + 0x11) & 0xffff, 0x01);
  loc_125f(m);

  assert.equal(m.tstates, 86, "mutation loses 4 T (23 -> 19)");
});
