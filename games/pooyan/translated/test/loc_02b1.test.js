// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_02b1 (ROM 0x02b1-0x02b8): write tile 0x10 into three cells DE
// apart, ret. Leaf routine; A holds 0x10 across all three stores.
//
// Run: node --test games/pooyan/translated/test/loc_02b1.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_02b1 } from "../loc_02b1.js";

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

test("loc_02b1: writes 0x10 into three DE-apart cells, ret; 60 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x84e0;
  m.regs.de = 0x0020;

  loc_02b1(m);

  assert.equal(m.tstates, 60, "loc_02b1 T-state total (7+7+11+7+11+7+10)");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.regs.a, 0x10, "A loaded with 0x10");
  assert.equal(m.mem.read8(0x84e0), 0x10, "cell 0");
  assert.equal(m.mem.read8(0x8500), 0x10, "cell 1 (+DE)");
  assert.equal(m.mem.read8(0x8520), 0x10, "cell 2 (+2*DE)");
  assert.equal(m.regs.hl, 0x8520, "HL = base + 2*DE");
  assert.deepEqual(m.pcSeq, [0x02b3, 0x02b4, 0x02b5, 0x02b6, 0x02b7, 0x02b8, CALLER_RET], "step boundaries");
});

test("loc_02b1 MUTATION: dropping the last `ld (hl),a` step (7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x84e0;
  m.regs.de = 0x0020;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x02b8 ? 0 : c);
  loc_02b1(m);
  assert.equal(m.tstates, 53, "mutation drops 7 T (the third store step)");
  assert.notEqual(m.tstates, 60, "golden T-state total catches the mutant");
});
