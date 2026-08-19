// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for loc_0038 (ROM 0x0038-0x0052): the rst 0x38 display-command enqueue.
// Self-contained mock machine (real Regs, flat 64K RAM). Ends in `ret`; the seated caller proves
// the exit. Covers the enqueue+advance path (MAME's live trace 0x004a->0x004e), the wrap path, and
// the slot-occupied skip. Run: node --test games/pooyan/translated/test/loc_0038.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0038 } from "../loc_0038.js";

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

test("loc_0038: free slot -> store DE, advance pointer, HL restored, ret; 132 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x1234;          // HL must be preserved across the routine
  m.regs.de = 0x0611;          // command word: D=0x06, E=0x11
  m.mem.write8(0x88a0, 0xc0);  // write pointer low
  m.mem.write8(0x88c0, 0xff);  // slot free (bit 7 set)

  loc_0038(m);

  assert.equal(m.tstates, 132, "loc_0038 enqueue-path T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.mem.read8(0x88c0), 0x06, "D stored at slot");
  assert.equal(m.mem.read8(0x88c1), 0x11, "E stored at slot+1");
  assert.equal(m.mem.read8(0x88a0), 0xc2, "pointer advanced by 2");
  assert.equal(m.regs.hl, 0x1234, "HL popped back to entry value");
  assert.deepEqual(m.pcSeq,
    [0x0039, 0x003b, 0x003e, 0x003f, 0x0041, 0x0043, 0x0044, 0x0045, 0x0046, 0x0047, 0x0048, 0x004a, 0x004e, 0x0051, 0x0052, CALLER_RET],
    "step boundaries (jr nc taken: 0x004a -> 0x004e, matching MAME)");
});

test("loc_0038: pointer wraps below 0xc0 -> clamped to 0xc0; 134 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x0abc;
  m.mem.write8(0x88a0, 0xfe);  // last slot
  m.mem.write8(0x88fe, 0xff);  // free

  loc_0038(m);

  assert.equal(m.tstates, 134, "wrap path adds the ld a,0xc0 step");
  assert.equal(m.mem.read8(0x88fe), 0x0a, "D stored");
  assert.equal(m.mem.read8(0x88ff), 0xbc, "E stored");
  assert.equal(m.mem.read8(0x88a0), 0xc0, "pointer wrapped 0x00 -> clamped to 0xc0");
  assert.deepEqual(m.pcSeq,
    [0x0039, 0x003b, 0x003e, 0x003f, 0x0041, 0x0043, 0x0044, 0x0045, 0x0046, 0x0047, 0x0048, 0x004a, 0x004c, 0x004e, 0x0051, 0x0052, CALLER_RET],
    "step boundaries (jr nc not taken: 0x004a -> 0x004c -> 0x004e)");
});

test("loc_0038: occupied slot (bit 7 clear) -> skip enqueue; 79 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x0611;
  m.mem.write8(0x88a0, 0xc0);
  m.mem.write8(0x88c0, 0x06);  // slot occupied (bit 7 clear)

  loc_0038(m);

  assert.equal(m.tstates, 79, "skip path total (jr z taken)");
  assert.equal(m.mem.read8(0x88c0), 0x06, "slot untouched");
  assert.equal(m.mem.read8(0x88a0), 0xc0, "pointer not advanced");
  assert.deepEqual(m.pcSeq,
    [0x0039, 0x003b, 0x003e, 0x003f, 0x0041, 0x0051, 0x0052, CALLER_RET],
    "step boundaries (jr z taken: 0x0041 -> 0x0051)");
});

test("loc_0038 MUTATION: `ld a,(0x88a0)` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.de = 0x0611;
  m.mem.write8(0x88a0, 0xc0);
  m.mem.write8(0x88c0, 0xff);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x003e ? 7 : c); // memory-read landing under-charged
  loc_0038(m);
  assert.equal(m.tstates, 126, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 132, "golden T-state total catches the mutant");
});
