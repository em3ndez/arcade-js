// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1f40 (ROM 0x1f40, Pooyan) -- ROM self-check guard entry (loc_32bd
 * `jp nz,0x1f40`). `dec b`, then the 0x1f41 table-scan (shared, inlined loop-latch): scan (HL) for A,
 * C tracks the slot; no match -> ret (0x1f48). A match falls into loc_1f2f's tail at 0x1f4e -- slot
 * C==0 renders the BCD round counter (loc_1f8c, glyph table by DAA bit4, rst 0x10, stash 0x8901),
 * otherwise it jumps to 0x1f7a; either way it draws the fixed label (loc_0c45 + loc_1f8c).
 *
 * The mock's `call` POPS the return address the call site pushed (models the callee's `ret`); a missing
 * push16 desyncs the stack so the final ret lands off the seated caller. loc_1f8c/loc_0010/loc_0c45
 * need no register modelling -- nothing loc_1f40 branches on reads their output.
 *
 * Paths: NOMATCH (loop exhausts -> ret 0x1f48); MATCH_C0 (slot 0, bit4 clear -> full render, jr z 0x1f68
 * not taken); MATCH_BIT4 (slot 0, bit4 set -> jr nz,0x1f68 taken); MATCH_Cnz (slot != 0 -> jr nz,0x1f7a).
 * TEETH: mis-charge the loop-exit `m.step(0x1f48)` (8 T) as 5 T -> the 83-T NOMATCH golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_1f40.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1f40 } from "../loc_1f40.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1f40, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

// BCD count loop (0x1f59): n-1 taken iterations then one djnz-not-taken exit to 0x1f5e.
function bcd(n) {
  const a = [];
  for (let i = 0; i < n - 1; i++) a.push(0x1f5b, 0x1f5c, 0x1f59);
  a.push(0x1f5b, 0x1f5c, 0x1f5e);
  return a;
}

// Render tail after the DAA bit4 select. `deStep` is the 0x1f63 branch tail (0x1f65 present or skipped).
function renderTail() {
  return [
    0x1f6b, 0x1f8c, 0x1f70, 0x1f72, 0x0010,
    0x1f76, 0x1f79, 0x1f7a, 0x1f7d, 0x0c45, 0x1f83, 0x1f8c, CALLER_RET,
  ];
}

test("loc_1f40 NOMATCH: loop exhausts -> ret 0x1f48", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0xaa;
  m.regs.b = 0x03;   // dec b -> 2 loop passes
  m.regs.c = 0x00;
  m.regs.hl = 0x9000;
  m.mem.write8(0x9000, 0x00);
  m.mem.write8(0x9001, 0x01); // neither equals 0xaa

  loc_1f40(m);

  assert.equal(m.tstates, 83, "T for two no-match passes + ret");
  assert.deepEqual(m.pcSeq, [
    0x1f41, 0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f41, 0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f48, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.regs.c, 0x02, "C advanced past two non-matches");
  assert.equal(m.pc, CALLER_RET, "ret 0x1f48 to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack unwound");
});

test("loc_1f40 MATCH_C0: slot 0, bit4 clear -> full render (jr z,0x1f68 not taken)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.b = 0x02;
  m.regs.c = 0x00;
  m.regs.hl = 0x9000;
  m.mem.write8(0x9000, 0x05);  // first byte matches -> C stays 0
  m.mem.write8(0x8907, 0x02);  // +1 -> B=3 BCD iters -> A=0x03, bit4 clear
  m.mem.write8(0x8901, 0x07);  // stashed into 0x8743

  loc_1f40(m);

  assert.equal(m.tstates, 314, "MATCH_C0 T total");
  assert.deepEqual(m.pcSeq, [
    0x1f41, 0x1f42, 0x1f4e, 0x1f4f, 0x1f50, 0x1f52, 0x1f55, 0x1f57, 0x1f58, 0x1f59,
    ...bcd(3),
    0x1f61, 0x1f63, 0x1f65, 0x1f68,
    ...renderTail(),
  ]);
  assert.deepEqual(m.calls, [0x1f8c, 0x0010, 0x0c45, 0x1f8c]);
  assert.equal(m.mem.read8(0x8743), 0x07, "0x8901 stashed to 0x8743");
  assert.equal(m.regs.a, 0x00, "A cleared by xor a at 0x1f79");
  assert.equal(m.pc, CALLER_RET, "ret 0x1f86");
  assert.equal(m.regs.sp, 0x8780, "every push16 matched a callee ret -> baseline");
});

test("loc_1f40 MATCH_BIT4: slot 0, bit4 set -> jr nz,0x1f68 taken (skip 0x1f65)", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.b = 0x02;
  m.regs.c = 0x00;
  m.regs.hl = 0x9000;
  m.mem.write8(0x9000, 0x05);
  m.mem.write8(0x8907, 0x09);  // +1 -> B=10 BCD iters -> A=0x10, bit4 set
  m.mem.write8(0x8901, 0x00);

  loc_1f40(m);

  assert.equal(m.tstates, 477, "MATCH_BIT4 T total");
  assert.deepEqual(m.pcSeq, [
    0x1f41, 0x1f42, 0x1f4e, 0x1f4f, 0x1f50, 0x1f52, 0x1f55, 0x1f57, 0x1f58, 0x1f59,
    ...bcd(10),
    0x1f61, 0x1f63, 0x1f68, // jr nz taken skips 0x1f65
    ...renderTail(),
  ]);
  assert.deepEqual(m.calls, [0x1f8c, 0x0010, 0x0c45, 0x1f8c]);
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_1f40 MATCH_Cnz: slot != 0 -> jr nz,0x1f7a, skip round render", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x05;
  m.regs.b = 0x03;   // dec -> 2 passes available
  m.regs.c = 0x00;
  m.regs.hl = 0x9000;
  m.mem.write8(0x9000, 0x00); // miss -> C=1
  m.mem.write8(0x9001, 0x05); // match on second -> slot C=1 != 0

  loc_1f40(m);

  assert.equal(m.tstates, 144, "MATCH_Cnz T total");
  assert.deepEqual(m.pcSeq, [
    0x1f41, 0x1f42, 0x1f44, 0x1f45, 0x1f46, 0x1f41, 0x1f42, 0x1f4e, 0x1f4f, 0x1f50, 0x1f7a,
    0x1f7d, 0x0c45, 0x1f83, 0x1f8c, CALLER_RET,
  ]);
  assert.deepEqual(m.calls, [0x0c45, 0x1f8c], "no round render -> no loc_1f8c/rst before the label");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_1f40 MUTATION: loop-exit `m.step(0x1f48)` mis-charged 5T (not 8T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1f48 ? 5 : cycles);
  seatCaller(m);
  m.regs.a = 0xaa;
  m.regs.b = 0x03;
  m.regs.c = 0x00;
  m.regs.hl = 0x9000;
  m.mem.write8(0x9000, 0x00);
  m.mem.write8(0x9001, 0x01);

  loc_1f40(m);

  assert.equal(m.tstates, 80, "mutation loses 3 T (8 -> 5)");
  assert.throws(() => assert.equal(m.tstates, 83, "NOMATCH golden"), /83/);
});
