// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for the translated loc_032a (Pooyan ROM 0x032A) -- the straight
 * object->display-list copy loop (four raw bytes per object, IX += DE each pass, B objects).
 *
 * Self-contained mock: real Regs (exact flags), flat 64K RAM, step/call/ret/push16/pop16 mirroring
 * the Machine. A leaf routine (single `ret`), so the mock seats a known caller return address and
 * makes no calls. `pcSeq` records every step boundary for an exact stepcheck.
 *
 * Path (B=2, the driver's own count): two 4-byte records copied from IX=0x8A80 (stride 0x18) into
 * the list at 0x8840; the djnz loops once then falls through to `ret` (301 T). Plus a B=1 single
 * pass (153 T) proving the not-taken djnz exit.
 *
 * TEETH: mis-charge the first `add ix,de` (DD 19 = 15 T) as the un-prefixed `add hl,de` (11 T) --
 * a plausible dropped-DD-prefix error. The golden T-state total (301) MUST catch it.
 *
 * Run: node --test games/pooyan/translated/test/loc_032a.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_032a } from "../loc_032a.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x032a, pcSeq: [],
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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// Two object records at IX=0x8A80 / 0x8A98 (stride 0x18).
function setupTwo(m) {
  seatCaller(m);
  m.regs.hl = 0x8840;
  m.regs.ix = 0x8a80;
  m.regs.de = 0x0018;
  m.regs.b = 0x02;
  m.mem.write8(0x8a86, 0x11); m.mem.write8(0x8a90, 0x22); // rec0: (ix+6),(ix+0x10)
  m.mem.write8(0x8a84, 0x33); m.mem.write8(0x8a8f, 0x44); // rec0: (ix+4),(ix+0x0f)
  m.mem.write8(0x8a9e, 0x55); m.mem.write8(0x8aa8, 0x66); // rec1
  m.mem.write8(0x8a9c, 0x77); m.mem.write8(0x8aa7, 0x88);
}

const ITER = [0x032d, 0x032e, 0x032f, 0x0332, 0x0333, 0x0334, 0x0337, 0x0338, 0x0339,
  0x033c, 0x033d, 0x033e, 0x0340];
const EXPECTED_PC_SEQ_B2 = [
  ...ITER, 0x032a, // pass 1, djnz taken
  ...ITER, 0x0342, // pass 2, djnz falls through
  CALLER_RET,      // ret
];

test("loc_032a B=2: two records copied straight into the 0x8840 list", () => {
  const m = makeMachine();
  setupTwo(m);
  loc_032a(m);

  const b = (a) => m.mem.read8(a);
  assert.equal(m.tstates, 301, "B=2 T-state total");
  assert.equal(m.pc, CALLER_RET, "ends via ret");
  assert.deepEqual(m.calls, [], "leaf -- no calls");
  assert.deepEqual([b(0x8840), b(0x8841), b(0x8842), b(0x8843)], [0x11, 0x22, 0x33, 0x44], "rec0");
  assert.deepEqual([b(0x8844), b(0x8845), b(0x8846), b(0x8847)], [0x55, 0x66, 0x77, 0x88], "rec1");
  assert.equal(m.regs.hl, 0x8848, "HL advanced by 8");
  assert.equal(m.regs.ix, 0x8ab0, "IX advanced by 2*0x18");
  assert.equal(m.regs.b, 0x00, "B counted to 0");
  assert.equal(m.regs.a, 0x88, "A = last byte copied");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_B2, "step boundaries match the disassembly");
});

test("loc_032a B=1: single pass, djnz not taken", () => {
  const m = makeMachine();
  setupTwo(m);
  m.regs.b = 0x01;
  loc_032a(m);
  assert.equal(m.tstates, 153, "B=1 = 135 body + 8 djnz + 10 ret");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual([m.mem.read8(0x8840), m.mem.read8(0x8843)], [0x11, 0x44]);
  assert.equal(m.mem.read8(0x8844), 0x00, "second record NOT copied");
  assert.equal(m.regs.ix, 0x8a98, "IX advanced by one stride");
});

test("loc_032a MUTATION: first `add ix,de` mis-charged 11T (dropped DD prefix) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0340) { first = false; return realStep(nextAddr, 11); }
    return realStep(nextAddr, cycles);
  };
  setupTwo(m);
  loc_032a(m);
  assert.equal(m.tstates, 297, "mutation loses 4 T (15 -> 11)");
  assert.throws(() => assert.equal(m.tstates, 301, "B=2 T-state total"), /T-state total/);
});
