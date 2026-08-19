// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_7e6d (ROM 0x7e6d-0x7e93): the 0x64be-downward integrity sum guard.
// Flat-RAM mock (ROM bytes hardcoded as literals -> no ROM file needed). Every exit is a ret.
// Run: node --test games/pooyan/translated/test/loc_7e6d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_7e6d } from "../loc_7e6d.js";

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

test("loc_7e6d: (0x8988)<4 -> immediate ret c; 31 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8988, 0x03); // < 4 -> carry -> ret c
  loc_7e6d(m);
  assert.equal(m.tstates, 31, "ld(13)+cp(7)+ret c taken(11) = 31");
  assert.equal(m.pc, CALLER_RET, "returns via ret c");
  assert.deepEqual(m.pcSeq, [0x7e70, 0x7e72, CALLER_RET], "exits at ret c");
});

test("loc_7e6d: 2-byte sum then 0x34 sentinel; bumps (0x89ef); 231 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8988, 0x05); // >= 4 -> proceed
  m.mem.write8(0x8a5f, 0x00); // == 0 -> proceed
  m.mem.write8(0x64be, 0xff);
  m.mem.write8(0x64bd, 0x91);
  m.mem.write8(0x64bc, 0x34); // sentinel

  loc_7e6d(m);

  assert.equal(m.tstates, 231, "loc_7e6d 2-iteration T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.regs.e, 0x01, "E = carry count (one carry)");
  assert.equal(m.regs.c, 0x90, "C = 0xff + 0x91 = 0x90 (wrapped)");
  assert.equal(m.mem.read8(0x89ef), 0x01, "(0x89ef) tamper counter bumped: (E+C)&0xb0 != 0");
  assert.deepEqual(m.pcSeq,
    [0x7e70, 0x7e72, 0x7e73, 0x7e76, 0x7e77, 0x7e78, 0x7e7b, 0x7e7d, 0x7e7e,
     0x7e7f, 0x7e80, 0x7e81, 0x7e82, 0x7e85, 0x7e87, 0x7e88, 0x7e7e,
     0x7e7f, 0x7e80, 0x7e81, 0x7e82, 0x7e84, 0x7e85, 0x7e87, 0x7e88, 0x7e8a,
     0x7e8b, 0x7e8c, 0x7e8e, 0x7e8f, 0x7e92, 0x7e93, CALLER_RET],
    "step boundaries");
});

test("loc_7e6d: (E+C)&0xb0 == 0 -> ret z, no bump", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8988, 0x05);
  m.mem.write8(0x8a5f, 0x00);
  m.mem.write8(0x64be, 0x00);
  m.mem.write8(0x64bd, 0x34); // sentinel on the second read
  loc_7e6d(m);
  assert.equal(m.pc, CALLER_RET, "returns via ret z");
  assert.equal(m.mem.read8(0x89ef), 0x00, "(0x89ef) NOT bumped");
});

test("loc_7e6d: (0x8a5f) != 0 -> ret nz before the loop", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8988, 0x05);
  m.mem.write8(0x8a5f, 0x01); // non-zero -> ret nz
  loc_7e6d(m);
  assert.equal(m.pc, CALLER_RET, "returns via ret nz");
  assert.deepEqual(m.pcSeq, [0x7e70, 0x7e72, 0x7e73, 0x7e76, 0x7e77, CALLER_RET], "exits at ret nz");
});

test("loc_7e6d MUTATION: `dec hl` mis-charged 0T (not 6T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8988, 0x05);
  m.mem.write8(0x8a5f, 0x00);
  m.mem.write8(0x64be, 0xff);
  m.mem.write8(0x64bd, 0x91);
  m.mem.write8(0x64bc, 0x34);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x7e80 ? 0 : c); // dec hl lands at 0x7e80, fires twice
  loc_7e6d(m);
  assert.equal(m.tstates, 219, "mutation loses 2*6 = 12 T");
  assert.notEqual(m.tstates, 231, "golden T-state total catches the mutant");
});
