// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for translated loc_6069 (ROM 0x6069-0x607f, Pooyan). Entry (also a `jp nz` target
 * from 0x60fb). Reads (HL); if 0 tail-jumps loc_60f2. Else checks (HL+2)==5, else tail-jumps loc_60f2.
 * If 0x8907 bit0 set tail-jumps loc_61b4, otherwise falls through into loc_6080.
 *
 * The mock's `call` POPS (models the tail callee's eventual `ret` consuming the seated CALLER_RET), so
 * every path ends with SP back at the pre-seat baseline. loc_6069 has no internal pushing call.
 *
 * Paths: Z0 (HL==0 -> loc_60f2), NZ5 ((HL+2)!=5 -> loc_60f2), B1 (0x8907 bit0 set -> loc_61b4),
 * FT (bit0 clear -> fall through to loc_6080). TEETH: mis-charge `ld a,(0x8907)` (13 T) as 7 T.
 *
 * Run: node --test games/pooyan/translated/test/loc_6069.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6069 } from "../loc_6069.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6069, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; }, // tail callee ret pops CALLER_RET
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const HL = 0x8b70;

test("loc_6069 Path Z0: (HL)==0 -> tail-jump loc_60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HL;
  m.mem.write8(HL, 0x00);

  loc_6069(m);

  assert.equal(m.tstates, 21, "Path Z0 T-state total");
  assert.deepEqual(m.pcSeq, [0x606a, 0x606b, 0x60f2]);
  assert.equal(m.pc, 0x60f2);
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.sp, 0x8780, "tail: stack unwound to baseline");
});

test("loc_6069 Path NZ5: (HL+2)!=5 -> tail-jump loc_60f2", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HL;
  m.mem.write8(HL, 0x03);        // (HL) != 0 -> jp z not taken
  m.mem.write8(HL + 2, 0x04);    // (HL+2) != 5 -> jp nz taken

  loc_6069(m);

  assert.equal(m.tstates, 61, "Path NZ5 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x606a, 0x606b, 0x606e, 0x606f, 0x6070, 0x6071, 0x6072, 0x6073, 0x6075, 0x60f2,
  ]);
  assert.equal(m.pc, 0x60f2);
  assert.deepEqual(m.calls, [0x60f2]);
  assert.equal(m.regs.l, 0x70, "L restored after the two inc/dec pairs");
  assert.equal(m.regs.sp, 0x8780, "tail: stack unwound to baseline");
});

test("loc_6069 Path B1: 0x8907 bit0 set -> tail-jump loc_61b4", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HL;
  m.mem.write8(HL, 0x03);
  m.mem.write8(HL + 2, 0x05);    // (HL+2)==5 -> jp nz not taken
  m.mem.write8(0x8907, 0x01);    // bit0 set -> jp nz taken

  loc_6069(m);

  assert.equal(m.tstates, 92, "Path B1 T-state total");
  assert.deepEqual(m.pcSeq, [
    0x606a, 0x606b, 0x606e, 0x606f, 0x6070, 0x6071, 0x6072, 0x6073, 0x6075,
    0x6078, 0x607b, 0x607d, 0x61b4,
  ]);
  assert.equal(m.pc, 0x61b4);
  assert.deepEqual(m.calls, [0x61b4]);
  assert.equal(m.regs.sp, 0x8780, "tail: stack unwound to baseline");
});

test("loc_6069 Path FT: 0x8907 bit0 clear -> fall through into loc_6080", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HL;
  m.mem.write8(HL, 0x03);
  m.mem.write8(HL + 2, 0x05);
  m.mem.write8(0x8907, 0x00);    // bit0 clear -> jp nz not taken -> fall through

  loc_6069(m);

  assert.equal(m.tstates, 92, "Path FT T-state total");
  assert.deepEqual(m.pcSeq, [
    0x606a, 0x606b, 0x606e, 0x606f, 0x6070, 0x6071, 0x6072, 0x6073, 0x6075,
    0x6078, 0x607b, 0x607d, 0x6080,
  ]);
  assert.equal(m.pc, 0x6080, "last step lands on the loc_6080 entry");
  assert.deepEqual(m.calls, [0x6080], "fall-through delegate to loc_6080");
  assert.equal(m.regs.sp, 0x8780, "tail: stack unwound to baseline");
});

test("loc_6069 MUTATION: `ld a,(0x8907)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = HL;
  m.mem.write8(HL, 0x03);
  m.mem.write8(HL + 2, 0x05);
  m.mem.write8(0x8907, 0x00);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x607b ? 7 : c); // ld a,(0x8907) steps to 0x607b

  loc_6069(m);

  assert.equal(m.tstates, 86, "mutation loses 6 T (13 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 92, "Path FT T-state total"), /92/,
    "the 92-T golden must fail on the mutant");
});
