// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence tests for translated loc_0986 (ROM 0x0986, Pooyan) -- attract sub-state 3.
// A countdown gate at (0x8e50): `ret nz` while it is still running; on the tick it hits zero,
// zero-fill scratch (0x02b9), reset the tile pointer (0x02e3), advance the sub-state (0x8e51),
// and seat 0x0b26 into the (0x8f48) vector, then `ret`.
//
// Flat-RAM mock (real Regs for exact flags). Delegated calls are recorded; the balancing stub
// pops the pushed return (SP += 2) so the caller's slot is what the final `ret` lands on.
//
// Run: node --test games/pooyan/translated/test/loc_0986.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0986 } from "../loc_0986.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0986, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); regs.sp = (regs.sp + 2) & 0xffff; return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_0986 Path A: countdown reaches 0 -> full advance, ret; 117 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e50, 0x01); // dec -> 0x00 -> falls through the ret nz
  m.mem.write8(0x8e51, 0x03); // sub-state -> 0x04

  loc_0986(m);

  assert.equal(m.tstates, 117, "Path A total T");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.equal(m.regs.sp, 0x8780, "both call pushes balanced, ret popped the caller");
  assert.deepEqual(m.calls, [0x02b9, 0x02e3], "delegates in order");
  assert.equal(m.mem.read8(0x8e50), 0x00, "(0x8e50) counter reached 0");
  assert.equal(m.mem.read8(0x8e51), 0x04, "(0x8e51) sub-state advanced");
  assert.equal(m.mem.read16(0x8f48), 0x0b26, "(0x8f48) vector = 0x0b26");
  assert.deepEqual(m.pcSeq,
    [0x0989, 0x098a, 0x098b, 0x02b9, 0x02e3, 0x0994, 0x0995, 0x0998, 0x099b, CALLER_RET],
    "Path A step boundaries");
});

test("loc_0986 Path B: countdown still running -> ret nz, no side effects; 32 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e50, 0x05); // dec -> 0x04 (non-zero) -> ret nz
  m.mem.write8(0x8e51, 0x03);

  loc_0986(m);

  assert.equal(m.tstates, 32, "Path B total T (10 + 11 + ret nz taken 11)");
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.equal(m.regs.sp, 0x8780, "ret nz popped the caller");
  assert.deepEqual(m.calls, [], "no delegation on the early-out path");
  assert.equal(m.mem.read8(0x8e50), 0x04, "(0x8e50) decremented, still non-zero");
  assert.equal(m.mem.read8(0x8e51), 0x03, "(0x8e51) untouched");
  assert.deepEqual(m.pcSeq, [0x0989, 0x098a, CALLER_RET], "Path B step boundaries");
});

test("loc_0986 MUTATION: `ld (0x8f48),hl` mis-charged 10T (not 16T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8e50, 0x01);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x099b ? 10 : c);

  loc_0986(m);

  assert.equal(m.tstates, 111, "mutation loses 6 T (16 -> 10)");
  assert.notEqual(m.tstates, 117, "golden T-state total catches the mutant");
});
