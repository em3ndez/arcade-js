// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_0254 (ROM 0x0254-0x02A7) -- the per-frame worker called by loc_020f.
 * Low nibble of (0x883f) gates a short path; otherwise it walks a sprite-scroll
 * update over 0x8740/0x84e0 through helpers 0x02a8/0x02aa/0x02b1. The mock seats a
 * caller return so a `ret` proves which exit fired, and models a `call` as the
 * callee running to its own ret (SP rebalanced). Golden T-states are computed
 * independently from the Z80 timings. Path A: (0x883f)&0x0f != 0 -> call 0x208c;
 * ret (61 T). Path B: low nibble 0, (0x8806)/(0x880e)/(0x880d) != 0, B bit4 set,
 * rrca carry set -> writes (0x84e0)=2, calls 0x02aa/0x02a8, tail-jp 0x02b1 (243 T).
 * TEETH: mis-charge `ld a,(0x883f)` (13 T) as 7 T on path A; the golden catches it.
 * Run: node --test games/pooyan/translated/test/loc_0254.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0254 } from "../loc_0254.js";

const CALLER_RET = 0xabcd;

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0254, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

function setupPathA(m) {
  seatCaller(m);
  m.mem.write8(0x883f, 0x11); // low nibble 1 -> jp z not taken -> call 0x208c
}

test("loc_0254 Path A: (0x883f)&0x0f != 0 -> call 0x208c; ret", () => {
  const m = makeMachine();
  setupPathA(m);
  loc_0254(m);
  assert.equal(m.pc, CALLER_RET, "ends via 0x0260 ret");
  assert.equal(m.tstates, 61, "Path A T-state total");
  assert.deepEqual(m.calls, [0x208c]);
  assert.deepEqual(m.pcSeq, [0x0257, 0x0258, 0x025a, 0x025d, 0x208c, CALLER_RET]);
  assert.equal(m.regs.b, 0x11, "B keeps the whole (0x883f) byte");
});

const EXPECTED_PC_SEQ_B = [
  0x0257, 0x0258, 0x025a, 0x0261, 0x0264, 0x0265, 0x0266, 0x0269, 0x026c, 0x026f,
  0x0270, 0x0272, 0x0274, 0x02aa, 0x027a, 0x02a8, 0x0280, 0x0281, 0x0284, 0x0286,
  0x0289, 0x028b, 0x028c, 0x028f, 0x0290, 0x0291, 0x02b1,
];

test("loc_0254 Path B: 0x880e!=0 branch -> writes + helpers -> tail jp 0x02b1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x883f, 0x10); // low nibble 0 -> jp z; B=0x10 (bit 4 set)
  m.mem.write8(0x8806, 0x05); // != 0 (also the rrca source: 0x05 -> carry set)
  m.mem.write8(0x880e, 0x01); // != 0 -> else branch at 0x0272
  m.mem.write8(0x880d, 0x01); // != 0 -> jr z not taken at 0x0284

  loc_0254(m);

  assert.equal(m.pc, 0x02b1, "tail-jumped to 0x02b1");
  assert.equal(m.tstates, 243, "Path B T-state total");
  assert.deepEqual(m.calls, [0x02aa, 0x02a8, 0x02b1]);
  assert.equal(m.mem.read8(0x84e0), 0x02, "(0x84e0) written by ld (hl),0x02");
  assert.equal(m.regs.b, 0x10);
  assert.equal(m.regs.hl, 0x84e0, "HL = 0x84e0 from the 0x880d!=0 arm");
  assert.equal(m.regs.a, 0x82, "A = rrca(0x05)");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_B, "step boundaries match the disassembly");
});

const EXPECTED_PC_SEQ_C = [
  0x0257, 0x0258, 0x025a, 0x0261, 0x0264, 0x0265, 0x0266, 0x0269, 0x026c, 0x026f,
  0x0270, 0x0294, 0x0297, 0x02b1, 0x029d, 0x02b1, 0x02b1, 0x02b1, 0x0277, 0x027a,
  0x02a8, 0x0280, 0x0281, 0x0284, 0x0289, 0x028b, CALLER_RET,
];

test("loc_0254 Path C: 0x880e==0 -> 0x0294 loop -> ret z (bit 4 clear)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x883f, 0x00); // low nibble 0 -> jp z; B=0x00 (bit 4 clear)
  m.mem.write8(0x8806, 0x03); // != 0 -> no ret z at 0x0265
  m.mem.write8(0x880e, 0x00); // == 0 -> jr z,0x0294 taken
  m.mem.write8(0x880d, 0x00); // == 0 -> jr z,0x0289 taken

  loc_0254(m);

  assert.equal(m.pc, CALLER_RET, "ends via 0x028b ret z");
  assert.equal(m.tstates, 290, "Path C T-state total");
  assert.deepEqual(m.calls, [0x02b1, 0x02b1, 0x02b1, 0x02b1, 0x02a8]);
  assert.equal(m.regs.hl, 0x8740, "HL = 0x8740 from the 0x880d==0 arm");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_C, "step boundaries match the disassembly");
});

test("loc_0254 MUTATION: `ld a,(0x883f)` mischarged 7 T (not 13) is caught", () => {
  const m = makeMachine();
  setupPathA(m);
  const real = m.step.bind(m);
  let first = true;
  m.step = (n, c) => { if (first && n === 0x0257) { first = false; return real(n, 7); } return real(n, c); };
  loc_0254(m);
  assert.equal(m.tstates, 55, "mutant lost exactly 6 T");
  assert.throws(() => assert.equal(m.tstates, 61, "Path A T-state total"), /Path A T-state total/);
});
