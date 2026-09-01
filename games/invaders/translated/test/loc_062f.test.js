// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_062f (ROM 0x062f-0x0643): scan 5 object slots (stride 0x0b) for the first
// non-empty one. Two arms: (a) all slots empty -> full loop, 5 iterations, then RET; (b) first slot
// non-empty -> rnz taken with carry set. Pins mem reads, register file, T-states, and the return.
//
// Run: node --test games/invaders/translated/test/loc_062f.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_062f } from "../loc_062f.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_062f: all 5 slots empty -> full scan loop then RET; 305 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x0c;
  m.mem.write8(0x2067, 0x20); // slot base high byte -> hl = 0x200b, stride 0x0b

  loc_062f(m);

  assert.equal(m.regs.c, 0x0b, "dcr c: 0x0c -> 0x0b");
  assert.equal(m.regs.h, 0x20, "h := mem[0x2067]");
  assert.equal(m.regs.l, 0x42, "l after 5x adi 0x0b: 0x0b -> 0x42");
  assert.equal(m.regs.a, 0x42, "a mirrors l on the last adi");
  assert.equal(m.regs.d, 0x00, "d counted 0x05 -> 0x00");
  assert.equal(m.tstates, 305, "T: setup 35 + 5x loop 52 + ret 10");
  assert.equal(m.pc, CALLER_RET, "RET returns to the seated caller");
  assert.deepEqual(m.calls, [], "no delegates");
  assert.equal(m.regs.sp, 0x2400, "RET pops the caller frame");
});

test("loc_062f: first slot non-empty -> rnz taken with carry set; 61 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x0c;
  m.mem.write8(0x2067, 0x20);
  m.mem.write8(0x200b, 0x01); // first scanned slot non-empty

  loc_062f(m);

  assert.equal(m.regs.a, 0x01, "a := non-empty slot byte");
  assert.equal(m.regs.d, 0x05, "d untouched -- exits on iteration 1");
  assert.equal(m.regs.fC, true, "stc set carry, rnz returns with it");
  assert.equal(m.tstates, 61, "T: setup 35 + mov/ana/stc/rnz(taken) 26");
  assert.equal(m.pc, CALLER_RET, "rnz returns to the seated caller");
  assert.deepEqual(m.calls, [], "no delegates");
});

test("loc_062f MUTATION: `lda 0x2067` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.c = 0x0c;
  m.mem.write8(0x2067, 0x20);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0633 ? 7 : c);
  loc_062f(m);
  assert.equal(m.tstates, 299, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 305, "golden T-state total catches the mutant");
});
