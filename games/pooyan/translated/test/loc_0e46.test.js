// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0e46 (ROM 0x0e46-0x0e52): AND-0xfb (clear bit 2) of six bytes at
// (HL), (HL+4), ... for B=6. Flat-RAM mock (real Regs); leaf routine (no calls).
//
// Run: node --test games/pooyan/translated/test/loc_0e46.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0e46 } from "../loc_0e46.js";

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

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0e46: clears bit 2 of 6 bytes stride-4, stops at slot 6; 292 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8900;
  for (let i = 0; i < 7; i++) m.mem.write8(0x8900 + i * 4, 0xff); // 7 slots armed; only 6 should clear
  m.mem.write8(0x8901, 0xff); // in-stride gap, must be untouched

  loc_0e46(m);

  assert.equal(m.tstates, 292, "T-state total (6 iters, last djnz not taken)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf");
  for (let i = 0; i < 6; i++) assert.equal(m.mem.read8(0x8900 + i * 4), 0xfb, `slot ${i} bit2 cleared`);
  assert.equal(m.mem.read8(0x8918), 0xff, "7th slot NOT touched (loop ran exactly 6)");
  assert.equal(m.mem.read8(0x8901), 0xff, "gap byte untouched");
  assert.equal(m.regs.hl, 0x8918, "HL = base + 6*4");
  assert.equal(m.regs.b, 0x00, "B counted down to 0");
  assert.equal(m.pcSeq[0], 0x0e49, "first landing");
  assert.deepEqual(m.pcSeq.slice(-2), [0x0e52, CALLER_RET], "exit boundary");
});

test("loc_0e46 MUTATION: add hl,de at 0x0e4f mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8900;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0e50 ? 7 : c); // 0x0e50 is the add's landing

  loc_0e46(m);

  assert.equal(m.tstates, 268, "mutation loses 6*4 T (11 -> 7 x6 iters)");
  assert.notEqual(m.tstates, 292, "golden T-state total catches the mutant");
});
