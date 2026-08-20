// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0ea2 (ROM 0x0ea2, Pooyan) -- append tile A into the 0x8a00-page
 * text ring. A is latched at 0x8d20 then stored (as B) at mem[0x8a00 | cursor]; the cursor at
 * 0x8a40 advances 0x43..0x5e and wraps 0x5e -> 0x43. Gated: 0x8806==0 AND 0x8f50==0 -> ret without work.
 *
 * Leaf: push bc/de/hl framed by pop hl/de/bc. The mock's push16/pop16 are real, so deleting any
 * push desyncs the pops (bc/de/hl restore wrong, final ret pops garbage) -- the balance has teeth.
 *
 * Paths: A (gate open via 0x8806, cursor 0x50 -> advance to 0x51); B (0x8806==0, 0x8f50!=0, cursor
 * 0x5e -> wrap to 0x43); C (both gates zero -> ret z at 0x0eaf). TEETH: mis-charge push bc 7T (not 11T).
 *
 * Run: node --test games/pooyan/translated/test/loc_0ea2.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0ea2 } from "../loc_0ea2.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0ea2, pcSeq: [],
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

const PC_A = [
  0x0ea5, 0x0ea8, 0x0ea9, 0x0eb0, 0x0eb3, 0x0eb4, 0x0eb5, 0x0eb6, 0x0eb7, 0x0eba,
  0x0ebb, 0x0ebc, 0x0ebe, 0x0ebf, 0x0ec0, 0x0ec2, 0x0ec4, 0x0ec5, 0x0ec6, 0x0ecb,
  0x0ecc, 0x0ecd, 0x0ece, CALLER_RET,
];

function setupA(m) {
  seatCaller(m);
  m.regs.a = 0x99;
  m.regs.bc = 0x1111; m.regs.de = 0x2222; m.regs.hl = 0x3333;
  m.mem.write8(0x8806, 0x01);  // gate open -> jr nz taken (0x8f50 not read)
  m.mem.write8(0x8a40, 0x50);  // cursor mid-range -> advance path
}

test("loc_0ea2 Path A: gate open, cursor 0x50 -> append + advance to 0x51", () => {
  const m = makeMachine();
  setupA(m);

  loc_0ea2(m);

  assert.equal(m.tstates, 208, "Path A T-state total");
  assert.deepEqual(m.pcSeq, PC_A, "step boundaries match ROM bytes");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.deepEqual(m.calls, [], "leaf -- no calls");
  assert.equal(m.mem.read8(0x8d20), 0x99, "A latched at 0x8d20");
  assert.equal(m.mem.read8(0x8a50), 0x99, "tile written at 0x8a00|cursor (0x8a50)");
  assert.equal(m.mem.read8(0x8a40), 0x51, "cursor advanced 0x50 -> 0x51");
  assert.equal(m.regs.bc, 0x1111, "bc restored");
  assert.equal(m.regs.de, 0x2222, "de restored");
  assert.equal(m.regs.hl, 0x3333, "hl restored");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_0ea2 Path B: 0x8806==0, 0x8f50!=0, cursor 0x5e -> wrap to 0x43", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x42;
  m.mem.write8(0x8806, 0x00);  // jr nz not taken
  m.mem.write8(0x8f50, 0x01);  // second gate open -> ret z not taken
  m.mem.write8(0x8a40, 0x5e);  // cursor at end -> wrap

  loc_0ea2(m);

  assert.equal(m.tstates, 221, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x0ea5, 0x0ea8, 0x0ea9, 0x0eab, 0x0eae, 0x0eaf, 0x0eb0, 0x0eb3, 0x0eb4, 0x0eb5,
    0x0eb6, 0x0eb7, 0x0eba, 0x0ebb, 0x0ebc, 0x0ebe, 0x0ebf, 0x0ec0, 0x0ec2, 0x0ec8,
    0x0eca, 0x0ecb, 0x0ecc, 0x0ecd, 0x0ece, CALLER_RET,
  ], "jr nz not taken, ret z not taken, jr z taken (wrap)");
  assert.equal(m.mem.read8(0x8a5e), 0x42, "tile written at 0x8a5e");
  assert.equal(m.mem.read8(0x8a40), 0x43, "cursor wrapped 0x5e -> 0x43");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound");
});

test("loc_0ea2 Path C: both gates zero -> ret z at 0x0eaf", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x11;
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8f50, 0x00);

  loc_0ea2(m);

  assert.equal(m.tstates, 65, "T = ld(nn),a + ld a,(nn) + and + jr nz nt + ld a,(nn) + and + ret z");
  assert.deepEqual(m.pcSeq, [0x0ea5, 0x0ea8, 0x0ea9, 0x0eab, 0x0eae, 0x0eaf, CALLER_RET]);
  assert.equal(m.mem.read8(0x8d20), 0x11, "A still latched before the gate check");
  assert.equal(m.mem.read8(0x8a40), 0x00, "cursor untouched -- no append");
  assert.equal(m.regs.sp, 0x8780, "no net stack change");
});

test("loc_0ea2 MUTATION: push bc mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x0eb4 ? 7 : cycles);
  setupA(m);

  loc_0ea2(m);

  assert.equal(m.tstates, 204, "mutation loses 4 T (11 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 208, "Path A T-state total"), /208/,
    "the 208-T golden must fail on the mutant");
});
