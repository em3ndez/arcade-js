// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1270 (ROM 0x1270-0x12ae, Pooyan) -- per-object update step.
 * Runs loc_4006, advances a sub-position (ix+0x05) by a step (ix+0x0a) with a borrow into the
 * coarse counter (ix+0x06), and -- when the coarse counter hits 0 -- runs a tick tail
 * (loc_3553, timer 0x8d40, counter 0x8901, state 0x880a, output 0x8743).
 *
 * Pinned paths:
 *   BORROW+EARLY-RET: step (ix+0x0a)=0x05 -> neg B=0xFB; (ix+0x05)=0x80 < 0xFB (cp b => carry) so
 *     jr nc NOT taken -> dec (ix+0x06) 0x03->0x02; add 0x05 => (ix+0x05)=0x85; (ix+0x06)=0x02 != 0
 *     so `ret nz` returns to the caller.
 *       T = 17+19+8+4+19+4+7+23+19+19+19+4+11 = 173.
 *   FULL-TAIL: step (ix+0x0a)=0x00 -> neg B=0x00; cp b never carries so jr nc TAKEN (no borrow);
 *     (ix+0x06)=0x00 => `ret nz` NOT taken; loc_3553; dec 0x8d40 (0x05->0x04); 0x8901=0x07 nonzero
 *     so dec (hl) -> 0x06; 0x880a=0x02 (!=4) so jr nz taken (no inc l/inc (hl)); C-1 = 0x06 < 0x0a
 *     so ret nc NOT taken -> store 0x06 to 0x8743 then ret.
 *       T = 17+19+8+4+19+4+12+19+19+19+4+5+17+10+11+10+7+4+4+7+11+13+7+12+4+4+7+5+13+10 = 305.
 *
 * TEETH: mis-charge `ld a,(ix+0x0a)` (19 T) as 7 T -- the golden T-state must catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_1270.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1270 } from "../loc_1270.js";

const CALLER_RET = 0xabcd;
const IX = 0x9000;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1270, pcSeq: [],
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
    // model the callee running to its own ret: pop the return the site pushed so SP rebalances
    call(addr, site) { this.calls.push(addr); this.site = site; this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

test("loc_1270: borrow path (A<B) decs coarse counter, then ret nz returns early", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x0a) & 0xffff, 0x05); // step -> neg B = 0xFB
  m.mem.write8((IX + 0x05) & 0xffff, 0x80); // sub-pos, 0x80 < 0xFB => cp b carry
  m.mem.write8((IX + 0x06) & 0xffff, 0x03); // coarse counter -> dec -> 0x02 (nonzero)
  loc_1270(m);

  assert.equal(m.tstates, 173, "T = 17+19+8+4+19+4+7+23+19+19+19+4+11");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x1276, 0x1278, 0x1279, 0x127c, 0x127d, 0x127f, 0x1282, 0x1285, 0x1288, 0x128b, 0x128c, CALLER_RET],
    "borrow branch: jr nc not taken -> dec (ix+6) -> ret nz taken back to caller");
  assert.deepEqual(m.calls, [0x4006], "only the shared pre-step ran; the tail (loc_3553) was skipped");
  assert.equal(m.mem.read8((IX + 0x06) & 0xffff), 0x02, "coarse counter decremented 0x03 -> 0x02");
  assert.equal(m.mem.read8((IX + 0x05) & 0xffff), 0x85, "sub-pos advanced 0x80 + 0x05 = 0x85");
  assert.equal(m.regs.b, 0xfb, "B = neg(step) = 0xFB");
  assert.equal(m.regs.a, 0x02, "A = coarse counter that gated the ret nz");
  assert.equal(m.regs.sp, 0x8780, "stack balanced: SP back to baseline after ret popped the caller");
});

test("loc_1270: full-tail path (coarse counter hits 0) runs the tick tail and stores to 0x8743", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x0a) & 0xffff, 0x00); // step 0 -> neg B = 0x00 => jr nc taken (no borrow)
  m.mem.write8((IX + 0x05) & 0xffff, 0x40); // sub-pos
  m.mem.write8((IX + 0x06) & 0xffff, 0x00); // coarse counter already 0 => ret nz not taken
  m.mem.write8(0x8d40, 0x05); // timer
  m.mem.write8(0x8901, 0x07); // counter (nonzero -> dec (hl))
  m.mem.write8(0x880a, 0x02); // state != 4 -> jr nz taken
  loc_1270(m);

  assert.equal(m.tstates, 305,
    "T = 17+19+8+4+19+4+12+19+19+19+4+5+17+10+11+10+7+4+4+7+11+13+7+12+4+4+7+5+13+10");
  assert.deepEqual(m.pcSeq,
    [0x4006, 0x1276, 0x1278, 0x1279, 0x127c, 0x127d, 0x1282, 0x1285, 0x1288, 0x128b, 0x128c, 0x128d,
     0x3553, 0x1293, 0x1294, 0x1297, 0x1298, 0x1299, 0x129a, 0x129c, 0x129d, 0x12a0, 0x12a2,
     0x12a6, 0x12a7, 0x12a8, 0x12aa, 0x12ab, 0x12ae, CALLER_RET],
    "no-borrow -> tail: dec counter, state!=4 skips inc, store to 0x8743, ret");
  assert.deepEqual(m.calls, [0x4006, 0x3553], "pre-step then the coarse-tick handler");
  assert.equal(m.mem.read8((IX + 0x05) & 0xffff), 0x40, "sub-pos advanced by 0 stays 0x40");
  assert.equal(m.mem.read8(0x8d40), 0x04, "timer 0x8d40 decremented 0x05 -> 0x04");
  assert.equal(m.mem.read8(0x8901), 0x06, "counter 0x8901 was nonzero -> dec (hl) 0x07 -> 0x06");
  assert.equal(m.mem.read8(0x8902), 0x00, "state != 4: inc l/inc (hl) NOT executed, 0x8902 untouched");
  assert.equal(m.regs.c, 0x07, "C = counter value snapshot before its dec");
  assert.equal(m.regs.a, 0x06, "A = C-1 = 0x06, the value stored");
  assert.equal(m.mem.read8(0x8743), 0x06, "(C-1) < 0x0a -> stored to 0x8743");
  assert.equal(m.regs.sp, 0x8780, "stack balanced: SP back to baseline after ret popped the caller");
});

test("loc_1270 MUTATION: `ld a,(ix+0x0a)` mis-charged 7T (not 19T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1276 ? 7 : cycles);
  seatCaller(m);
  m.regs.ix = IX;
  m.mem.write8((IX + 0x0a) & 0xffff, 0x05);
  m.mem.write8((IX + 0x05) & 0xffff, 0x80);
  m.mem.write8((IX + 0x06) & 0xffff, 0x03);
  loc_1270(m);

  assert.equal(m.tstates, 161, "mutation loses 12 T (19 -> 7)");
});
