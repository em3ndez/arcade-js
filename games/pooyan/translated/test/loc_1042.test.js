// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1042 (ROM 0x1042-0x107c, Pooyan) -- per-frame setup of the
 * object at ix=0x8a80. Sets (0x8f3f)=1, seats ix/iy, then branches:
 *   - (ix+0x02)!=0                 -> loc_1078: (ix+0x07)=0, ret
 *   - (0x8f24)|(0x8f57)!=0         -> loc_1078: (ix+0x07)=0, ret
 *   - else pick mask (0x881f?0xa0a0:0xa0c0), cpl, store (ix+0x07); then (ix+0x1e)!=0 ? ret
 *     : res 4,(ix+0x07), ret  (loc_106a)
 *
 * Pinned paths (all T-states hand-computed against standard Z80 timings; ld ix,nn=14,
 * ld a,(ix+d)=19, ld (ix+d),a/n=19, res b,(ix+d)=23, jr t/nt=12/7, ret t/nt=11/5, ret=10):
 *   A. (ix+2)!=0            -> jr@1053 taken -> loc_1078.  T = 112.
 *   B. all clear, 0x881f==0 -> full fall-through, ret nz nt, res 4.  T = 249.
 *   C. 0x881f!=0, (ix+0x1e)!=0 -> jr@1065 taken (uses 0xa0a0), ret nz taken.  T = 214.
 *   D. (0x8f24)|(0x8f57)!=0 -> jr@105c taken -> loc_1078.  T = 149.
 *
 * TEETH: mis-charge res 4,(ix+0x07) as 15 T (a plain res b,(hl)) instead of 23 T -- caught.
 *
 * Run: node --test games/pooyan/translated/test/loc_1042.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1042 } from "../loc_1042.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1042, pcSeq: [],
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
}

test("loc_1042 path A: (ix+0x02)!=0 -> loc_1078 clears (ix+0x07) and rets", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8a82, 0x01); // ix+2 nonzero -> jr nz @1053 taken
  m.mem.write8(0x8a87, 0x55); // ix+7 preset, must become 0
  loc_1042(m);

  assert.equal(m.tstates, 112, "T = 7+13+14+14+19+4+12(jr t)+19+10");
  assert.deepEqual(m.pcSeq,
    [0x1044, 0x1047, 0x104b, 0x104f, 0x1052, 0x1053, 0x1078, 0x107c, CALLER_RET],
    "early jr to loc_1078 then ret to caller");
  assert.deepEqual(m.calls, [], "no calls out");
  assert.equal(m.mem.read8(0x8f3f), 0x01, "(0x8f3f) set to 1");
  assert.equal(m.mem.read8(0x8a87), 0x00, "(ix+0x07) cleared");
  assert.equal(m.regs.ix, 0x8a80, "ix seated");
  assert.equal(m.regs.iy, 0x8c90, "iy seated");
  assert.equal(m.regs.sp, 0x8780, "SP balanced (no net push)");
});

test("loc_1042 path B: all-clear, 0x881f==0 -> mask 0xa0c0, cpl, store, res 4, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  // ix+2 == 0, (0x8f24)|(0x8f57) == 0, (0x881f) == 0
  m.mem.write8(0xa0c0, 0x0f); // selected mask (0x881f==0 path)
  m.mem.write8(0x8a9e, 0x00); // ix+0x1e == 0 -> ret nz NOT taken -> res 4
  loc_1042(m);

  assert.equal(m.tstates, 249,
    "T = 7+13+14+14+19+4+7 +13+10+7+7 +13+4+13+7+13 +4+19+19+4+5(retnz nt)+23(res)+10");
  assert.deepEqual(m.pcSeq,
    [0x1044, 0x1047, 0x104b, 0x104f, 0x1052, 0x1053, 0x1055, 0x1058, 0x105b, 0x105c,
     0x105e, 0x1061, 0x1062, 0x1065, 0x1067, 0x106a, 0x106b, 0x106e, 0x1071, 0x1072,
     0x1073, 0x1077, CALLER_RET],
    "full fall-through incl the 0xa0c0 load and the res-4 tail");
  assert.deepEqual(m.calls, [], "no calls out");
  assert.equal(m.regs.a, 0x00, "A ends = (ix+0x1e) read (0) -- it overwrites the cpl result after the store");
  assert.equal(m.mem.read8(0x8a87), 0xe0, "(ix+0x07) = stored cpl(0x0f)=0xf0 with bit 4 cleared = 0xe0");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
});

test("loc_1042 path C: 0x881f!=0 uses 0xa0a0; (ix+0x1e)!=0 -> ret nz taken (no res)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x881f, 0x01); // nonzero -> jr nz @1065 taken -> use 0xa0a0
  m.mem.write8(0xa0a0, 0x33);
  m.mem.write8(0x8a9e, 0x05); // ix+0x1e nonzero -> ret nz taken
  loc_1042(m);

  assert.equal(m.tstates, 214,
    "T = 7+13+14+14+19+4+7 +13+10+7+7 +13+4+13+12(jr t) +4+19+19+4+11(retnz t)");
  assert.deepEqual(m.pcSeq,
    [0x1044, 0x1047, 0x104b, 0x104f, 0x1052, 0x1053, 0x1055, 0x1058, 0x105b, 0x105c,
     0x105e, 0x1061, 0x1062, 0x1065, 0x106a, 0x106b, 0x106e, 0x1071, 0x1072, CALLER_RET],
    "jr@1065 skips the 0xa0c0 load; ret nz returns before res");
  assert.equal(m.mem.read8(0x8a87), 0xcc, "(ix+0x07) = cpl(0x33) = 0xcc (bit4 NOT cleared)");
  assert.equal(m.regs.a, 0x05, "A = last read (ix+0x1e)");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
});

test("loc_1042 path D: (0x8f24)|(0x8f57)!=0 -> loc_1078", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f57, 0x80); // or (hl) nonzero -> jr nz @105c taken
  m.mem.write8(0x8a87, 0x77);
  loc_1042(m);

  assert.equal(m.tstates, 149, "T = 7+13+14+14+19+4+7 +13+10+7+12(jr t) +19+10");
  assert.deepEqual(m.pcSeq,
    [0x1044, 0x1047, 0x104b, 0x104f, 0x1052, 0x1053, 0x1055, 0x1058, 0x105b, 0x105c,
     0x1078, 0x107c, CALLER_RET],
    "or-nonzero jr to loc_1078");
  assert.equal(m.mem.read8(0x8a87), 0x00, "(ix+0x07) cleared");
  assert.equal(m.regs.sp, 0x8780, "SP balanced");
});

test("loc_1042 MUTATION: res 4,(ix+0x07) mis-charged 15T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1077 ? 15 : cycles);
  seatCaller(m);
  m.mem.write8(0xa0c0, 0x0f);
  m.mem.write8(0x8a9e, 0x00);
  loc_1042(m);

  assert.equal(m.tstates, 241, "mutation loses 8 T (23 -> 15)");
});
