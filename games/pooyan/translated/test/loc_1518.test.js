// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1518 (ROM 0x1518-0x1556, Pooyan) -- per-frame object update
 * with a phase-advance step.
 *
 * Pinned paths (IX base = 0x8800):
 *   A. timer still running: (ix+0x11)=2 -> dec -> 1 (nonzero) -> ret nz early.
 *      T = 17(call) + 23(dec) + 11(ret nz taken) = 51.
 *   B. timer expires, selector (0x8f60)=0 -> jr z skips sub-update; phase (ix+0x16)=3 (!=7) ->
 *      advance; loc_154d reloads timer to 1, dec -> 0 -> ret nz NOT taken -> jp 0x3553 tail.
 *      T = 242.
 *   C. timer expires, selector=0x03 (sla->0x06, nonzero) -> call 0x1131; C=0x05 (nonzero) ->
 *      store at 0x85e9; loc_1533 -> call 0x1119; phase (ix+0x16)=7 -> jp z,0x3d99 tail.
 *      T = 197.
 *
 * TEETH: mis-charge `dec (ix+0x11)` at 0x151b (23 T) as 11 T on path A -- caught by the golden T.
 *
 * Run: node --test games/pooyan/translated/test/loc_1518.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1518 } from "../loc_1518.js";

const CALLER_RET = 0xabcd;
const IX = 0x8800;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1518, pcSeq: [],
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
    // Callee ret pops what the site pushed (pattern-A call), or the seated caller (tail jp).
    call(addr, site) { this.calls.push(addr); this.site = site; this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.regs.ix = IX;
  m.push16(CALLER_RET);
}

test("loc_1518 A: timer still running -> ret nz early", () => {
  const m = makeMachine();
  seatCaller(m);
  m.ram[(IX + 0x11) & 0xffff] = 0x02; // dec -> 1, nonzero
  loc_1518(m);

  assert.equal(m.tstates, 51, "T = 17(call) + 23(dec) + 11(ret nz taken)");
  assert.deepEqual(m.pcSeq, [0x4006, 0x151e, CALLER_RET], "call, dec, then return to caller");
  assert.deepEqual(m.calls, [0x4006], "only the shared pre-step ran");
  assert.equal(m.ram[(IX + 0x11) & 0xffff], 0x01, "timer decremented to 1");
  assert.equal(m.regs.sp, 0x8780, "SP balanced: pre-step call/ret cancel, ret nz pops the seated caller");
});

test("loc_1518 B: timer expires, selector 0, phase!=7 -> advance -> jp 0x3553 tail", () => {
  const m = makeMachine();
  seatCaller(m);
  m.ram[(IX + 0x11) & 0xffff] = 0x01; // dec -> 0, timer expires
  m.ram[0x8f60] = 0x00;               // selector 0 -> sla 0, and a Z -> jr z skips sub-update
  m.ram[(IX + 0x16) & 0xffff] = 0x03; // phase != 7
  m.ram[(IX + 0x02) & 0xffff] = 0x40;
  loc_1518(m);

  assert.equal(m.tstates, 242, "full advance path through loc_154d to the 0x3553 tail");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x151e, 0x151f, 0x1522, 0x1524, 0x1525, 0x1526, 0x153a, 0x153d, 0x153f,
    0x1542, 0x1543, 0x1546, 0x154a, 0x154d, 0x4006, 0x1553, 0x1554, 0x3553,
  ], "jr z to 0x153a, jp z not taken, fall through loc_154d, jp 0x3553");
  assert.deepEqual(m.calls, [0x4006, 0x4006, 0x3553], "two pre-steps then the phase-advance tail");
  assert.equal(m.ram[(IX + 0x13) & 0xffff], 0x04, "new phase = 3 + 1 written to (ix+0x13)");
  assert.equal(m.ram[(IX + 0x11) & 0xffff], 0x00, "timer reloaded to 1 then dec'd to 0 at loc_154d");
  assert.equal(m.ram[(IX + 0x02) & 0xffff], 0x41, "(ix+0x02) bumped");
  assert.equal(m.regs.sp, 0x8780, "SP balanced: two call/ret pairs cancel, tail jp's ret consumes the caller");
});

test("loc_1518 C: selector nonzero + C nonzero (store) + phase==7 -> jp z,0x3d99 tail", () => {
  const m = makeMachine();
  seatCaller(m);
  m.ram[(IX + 0x11) & 0xffff] = 0x01; // dec -> 0, timer expires
  m.ram[0x8f60] = 0x03;               // sla -> 0x06, nonzero -> jr z NOT taken
  m.regs.c = 0x05;                    // C nonzero -> and a NZ -> store path
  m.ram[(IX + 0x16) & 0xffff] = 0x07; // phase == 7 -> jp z,0x3d99
  loc_1518(m);

  assert.equal(m.tstates, 197, "sub-update path with store, ending at the 0x3d99 tail");
  assert.deepEqual(m.pcSeq, [
    0x4006, 0x151e, 0x151f, 0x1522, 0x1524, 0x1525, 0x1526, 0x1528, 0x1131, 0x152c,
    0x152d, 0x152e, 0x1530, 0x1533, 0x1536, 0x1537, 0x1119, 0x153d, 0x153f, 0x3d99,
  ], "no jr z at 0x1526, store at 0x1530, loc_1533, then jp z to 0x3d99");
  assert.deepEqual(m.calls, [0x4006, 0x1131, 0x1119, 0x3d99], "pre-step, index resolve, sub-update, done tail");
  assert.equal(m.regs.b, 0x06, "B = sla(0x03) = 0x06");
  assert.equal(m.regs.e, 0x06, "E = A returned from 0x1131 (mock leaves A = 0x06)");
  assert.equal(m.ram[0x85e9], 0x05, "C stored at 0x85e9");
  assert.equal(m.regs.a, 0x07, "A = phase 7 at the jp z branch");
  assert.equal(m.regs.sp, 0x8780, "SP balanced: three call/ret pairs cancel, tail jp's ret consumes the caller");
});

test("loc_1518 MUTATION: `dec (ix+0x11)` at 0x151b mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x151e ? 11 : cycles);
  seatCaller(m);
  m.ram[(IX + 0x11) & 0xffff] = 0x02; // path A
  loc_1518(m);

  assert.equal(m.tstates, 39, "mutation loses 12 T (23 -> 11): 17 + 11 + 11");
});
