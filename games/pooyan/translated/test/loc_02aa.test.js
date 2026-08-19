// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_02aa (ROM 0x02aa-0x02b0): step HL by DE, write tile 0x25, step
// again, write tile 0x20, ret. Leaf routine; the seated caller return proves the exit.
//
// Run: node --test games/pooyan/translated/test/loc_02aa.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02aa } from "../loc_02aa.js";

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

test("loc_02aa: writes 0x25 and 0x20 two DE-steps apart, ret; 52 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8420;
  m.regs.de = 0x0020;

  loc_02aa(m);

  assert.equal(m.tstates, 52, "loc_02aa T-state total (11+10+11+10+10)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.mem.read8(0x8440), 0x25, "tile 0x25 at hl+DE");
  assert.equal(m.mem.read8(0x8460), 0x20, "tile 0x20 at hl+2*DE");
  assert.equal(m.regs.hl, 0x8460, "HL = base + 2*DE");
  assert.deepEqual(m.pcSeq, [0x02ab, 0x02ad, 0x02ae, 0x02b0, CALLER_RET], "step boundaries");
});

test("loc_02aa MUTATION: first `add hl,de` mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x8420;
  m.regs.de = 0x0020;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x02ab ? 7 : c);
  loc_02aa(m);
  assert.equal(m.tstates, 48, "mutation loses 4 T (11 -> 7)");
  assert.notEqual(m.tstates, 52, "golden T-state total catches the mutant");
});
