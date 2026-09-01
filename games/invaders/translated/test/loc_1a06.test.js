// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_1a06 (ROM 0x1a06-0x1a10): predicate on bit7 of mem[DE] vs flag byte
// mem[0x2072]. Match arm falls through stc (carry SET, 54 T); differ arm returns early via rnz
// (carry CLEAR, 46 T). Pins registers, carry, T-states, step boundaries, and the caller ret.
//
// Run: node --test games/invaders/translated/test/loc_1a06.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1a06 } from "../loc_1a06.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_1a06 MATCH arm: bit7(DE) == flag -> stc, carry SET; 54 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x2500;
  m.mem.write8(0x2500, 0x80); // ldax d -> ani 0x80 = 0x80
  m.mem.write8(0x2072, 0x80); // flag byte -> B; xra -> 0

  loc_1a06(m);

  assert.equal(m.regs.b, 0x80, "B := mem[0x2072]");
  assert.equal(m.regs.a, 0x00, "A: (0x80 & 0x80) ^ 0x80 == 0");
  assert.equal(m.regs.hl, 0x2072, "HL seated at flag addr");
  assert.ok(m.regs.fC, "stc set carry (match)");
  assert.equal(m.tstates, 10 + 7 + 7 + 7 + 4 + 5 + 4 + 10, "T: lxi+movBm+ldax+ani+xra+rnz(nt)+stc+ret");
  assert.equal(m.pc, CALLER_RET, "ret to caller");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.deepEqual(m.pcSeq, [0x1a09, 0x1a0a, 0x1a0b, 0x1a0d, 0x1a0e, 0x1a0f, 0x1a10, CALLER_RET], "step boundaries");
});

test("loc_1a06 DIFFER arm: bit7(DE) != flag -> rnz early, carry CLEAR; 46 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x2500;
  m.mem.write8(0x2500, 0x00); // ani 0x80 = 0
  m.mem.write8(0x2072, 0x80); // xra -> 0x80 nonzero -> rnz taken

  loc_1a06(m);

  assert.equal(m.regs.a, 0x80, "A: 0 ^ 0x80 == 0x80");
  assert.ok(!m.regs.fC, "carry stays clear (ani/xra cleared it, stc skipped)");
  assert.equal(m.tstates, 10 + 7 + 7 + 7 + 4 + 11, "T: ...+rnz(taken 11)");
  assert.equal(m.pc, CALLER_RET, "rnz returns to caller");
  assert.deepEqual(m.pcSeq, [0x1a09, 0x1a0a, 0x1a0b, 0x1a0d, 0x1a0e, CALLER_RET], "step boundaries (no stc)");
});

test("loc_1a06 MUTATION: ani mis-charged 4T not 7T is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x2500;
  m.mem.write8(0x2500, 0x80);
  m.mem.write8(0x2072, 0x80);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x1a0d ? 4 : c);
  loc_1a06(m);
  assert.notEqual(m.tstates, 54, "golden T-state total catches the mutant");
});
