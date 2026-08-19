// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0a40 (ROM 0x0a40-0x0a51): the 2x2 tile-block copier split out of
// loc_0a28. Flat-RAM mock, real Regs. Plain ret, no calls. The `add hl,bc` (+0x20) then `dec l`
// is what places the bottom row -- the memory asserts have teeth on that addressing.
//
// Run: node --test games/pooyan/translated/test/loc_0a40.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0a40 } from "../loc_0a40.js";

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

test("loc_0a40: copies 4 source bytes into a 2x2 tile block; 113 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x9000;
  m.regs.hl = 0x8500;
  m.mem.write8(0x9000, 0xa1); m.mem.write8(0x9001, 0xa2);
  m.mem.write8(0x9002, 0xa3); m.mem.write8(0x9003, 0xa4);

  loc_0a40(m);

  assert.equal(m.tstates, 113, "full-path T-state total");
  assert.equal(m.pc, CALLER_RET, "plain ret to caller");
  assert.equal(m.mem.read8(0x8500), 0xa1, "top-left");
  assert.equal(m.mem.read8(0x8501), 0xa2, "top-right (after inc l)");
  assert.equal(m.mem.read8(0x8521), 0xa3, "bottom-right (after add hl,bc = +0x20)");
  assert.equal(m.mem.read8(0x8520), 0xa4, "bottom-left (after dec l)");
  assert.equal(m.regs.bc, 0x0020, "BC = row stride");
  assert.equal(m.regs.de, 0x9003, "DE advanced past the 4 source bytes");
  assert.equal(m.regs.hl, 0x8520, "HL ends at the bottom-left cell");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [], "leaf routine");
  assert.deepEqual(m.pcSeq,
    [0x0a43, 0x0a44, 0x0a45, 0x0a46, 0x0a47, 0x0a48, 0x0a49, 0x0a4a,
     0x0a4b, 0x0a4c, 0x0a4d, 0x0a4e, 0x0a4f, 0x0a50, 0x0a51, CALLER_RET],
    "instruction boundaries");
});

test("loc_0a40 MUTATION: add hl,bc mis-charged 6T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x9000; m.regs.hl = 0x8500;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0a4a ? 6 : c); // ADD HL,BC = 11T
  loc_0a40(m);
  assert.equal(m.tstates, 108, "mutation drops 5 T");
  assert.notEqual(m.tstates, 113, "golden total catches the mis-charged ADD HL,BC");
});
