// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_3325 (ROM 0x3325-0x3336): blit a 2x2 tile block. Four source bytes at (DE)
// are written to the square anchored at (HL): TL=HL, TR=HL+1, BR=HL+0x21, BL=HL+0x20 (BC=0x20 stride).
// Three `inc de` run, so DE ends at source+3 (on the last byte); HL ends at the bottom-left cell
// (anchor+0x20). Leaf routine: exits via `ret`.
//
// Run: node --test games/pooyan/translated/test/loc_3325.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3325 } from "../loc_3325.js";

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

test("loc_3325: 4 src bytes -> 2x2 block at (HL); DE=src+3, HL=anchor+0x20; 117 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x3600;                 // source record
  m.regs.hl = 0x8500;                 // video-RAM anchor
  m.mem.write8(0x3600, 0x11);         // TL
  m.mem.write8(0x3601, 0x22);         // TR
  m.mem.write8(0x3602, 0x33);         // BR
  m.mem.write8(0x3603, 0x44);         // BL

  loc_3325(m);

  assert.equal(m.tstates, 117, "loc_3325 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no delegations");
  assert.equal(m.regs.bc, 0x0020, "BC = row stride");
  assert.equal(m.regs.de, 0x3603, "DE = src+3 (three inc de; the last byte is read without advancing)");
  assert.equal(m.regs.hl, 0x8520, "HL ends at anchor + 0x20 (bottom-left)");
  assert.equal(m.mem.read8(0x8500), 0x11, "top-left");
  assert.equal(m.mem.read8(0x8501), 0x22, "top-right (anchor+1)");
  assert.equal(m.mem.read8(0x8521), 0x33, "bottom-right (anchor+0x21)");
  assert.equal(m.mem.read8(0x8520), 0x44, "bottom-left (anchor+0x20)");
  assert.deepEqual(m.pcSeq,
    [0x3328, 0x3329, 0x332a, 0x332b, 0x332c, 0x332d, 0x332e, 0x332f, 0x3330, 0x3331, 0x3332, 0x3333,
     0x3334, 0x3335, 0x3336, CALLER_RET],
    "step boundaries");
});

test("loc_3325 MUTATION: `add hl,bc` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x3600;
  m.regs.hl = 0x8500;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3330 ? 7 : c);
  loc_3325(m);
  assert.equal(m.tstates, 113, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 117, "golden T-state total catches the mutant");
});
