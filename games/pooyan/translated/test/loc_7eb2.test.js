// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_7eb2 (ROM 0x7eb2-0x7f0d, Pooyan) -- entry 0 of the 0x7e94 write-anim
 * dispatch table. Seeds the anim work-block 0x8e1f..0x8e2b from (0x89fc)/(0x880f)/(0x880d).
 *
 * Three paths, golden T-states computed independently from the Z80 timings:
 *   A. (0x89fc)=2, (0x880f)=0, (0x880d)=1 -> (0x8e21)=0x8812 (inner jr nz taken), 442 T.
 *   B. (0x89fc)=1, (0x880f)=1           -> (0x8e21)=0x8811 (outer jr nz taken), 377 T.
 *   C. (0x89fc)=1, (0x880f)=0, (0x880d)=0 -> (0x8e21)=0x8811 (both jr nz fall), 396 T.
 * Together they drive both arms of the 0x7eda and 0x7ee0 conditionals and both djnz loops.
 *
 * TEETH: mis-charge `add ix,de` (15 T) as 11, or `ld de,(nn)` (20 T) as 16; a golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_7eb2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7eb2 } from "../loc_7eb2.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x7eb2, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // No delegation in this routine; if one appeared, pop so a missing push16 is caught.
    call(addr) { this.calls.push(addr); this.pop16(); },
  };
}

function seedReturn(m) {
  m.regs.sp = 0x8780;
  m.push16(0x1234); // caller continuation the final `ret` must land on
}

const EXPECTED_PC_SEQ_A = [
  0x7eb5, 0x7eb8, 0x7eba, 0x7ebd, 0x7ec0, 0x7ec3, 0x7ec6, 0x7eca, 0x7ecb, 0x7ece,
  0x7ed0, 0x7ece, 0x7ed0, 0x7ed2,
  0x7ed6, 0x7ed9, 0x7eda,
  0x7edc, 0x7edf, 0x7ee0, 0x7ee7, 0x7eea,
  0x7eed, 0x7ef0, 0x7ef1, 0x7ef5,
  0x7ef6, 0x7ef7, 0x7ef5, 0x7ef6, 0x7ef7, 0x7ef9,
  0x7efd, 0x7eff, 0x7f00, 0x7f03, 0x7f05, 0x7f08, 0x7f0a, 0x7f0d,
  0x1234,
];

test("loc_7eb2 Path A: (0x880f)=0,(0x880d)!=0 -> (0x8e21)=0x8812; IX=0x8dfd+6", () => {
  const m = makeMachine();
  seedReturn(m);
  m.mem.write8(0x89fc, 0x02); // loop count B for both djnz loops
  m.mem.write8(0x880f, 0x00);
  m.mem.write8(0x880d, 0x01);

  loc_7eb2(m);

  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A);
  assert.equal(m.tstates, 442);
  assert.equal(m.calls.length, 0);           // no delegation

  // work-block writes
  assert.equal(m.mem.read8(0x8e25), 0x03);
  assert.equal(m.mem.read16(0x8e2b), 0x03a0);
  assert.equal(m.mem.read16(0x8e1f), 0x8e03); // 0x8dfd + 3*2
  assert.equal(m.mem.read16(0x8e21), 0x8812); // inner branch chose 0x8812
  assert.equal(m.mem.read16(0x8e27), 0x8569); // 0x8565 + 2*2 (advanced pointer)
  assert.equal(m.mem.read8(0x8569), 0x11);    // ld (de),a at the advanced pointer
  assert.equal(m.mem.read8(0x8e23), 0x11);
  assert.equal(m.mem.read8(0x8e26), 0x01);
  assert.equal(m.mem.read8(0x8e24), 0x0c);
  assert.equal(m.pc, 0x1234);                 // returned to caller
});

test("loc_7eb2 Path B: (0x880f)!=0 -> outer jr nz taken -> (0x8e21)=0x8811", () => {
  const m = makeMachine();
  seedReturn(m);
  m.mem.write8(0x89fc, 0x01);
  m.mem.write8(0x880f, 0x01);
  m.mem.write8(0x880d, 0x00); // must not matter on this path

  loc_7eb2(m);

  assert.equal(m.tstates, 377);
  assert.equal(m.mem.read16(0x8e1f), 0x8e00); // 0x8dfd + 3*1
  assert.equal(m.mem.read16(0x8e21), 0x8811);
  assert.equal(m.mem.read16(0x8e27), 0x8567); // 0x8565 + 2*1
  assert.equal(m.mem.read8(0x8567), 0x11);
  assert.equal(m.pc, 0x1234);
});

test("loc_7eb2 Path C: (0x880f)=0,(0x880d)=0 -> both jr nz fall -> (0x8e21)=0x8811", () => {
  const m = makeMachine();
  seedReturn(m);
  m.mem.write8(0x89fc, 0x01);
  m.mem.write8(0x880f, 0x00);
  m.mem.write8(0x880d, 0x00);

  loc_7eb2(m);

  assert.equal(m.tstates, 396);
  assert.equal(m.mem.read16(0x8e21), 0x8811);
  assert.equal(m.pc, 0x1234);
});
