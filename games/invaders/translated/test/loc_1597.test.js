// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1597 (ROM 0x1597-0x15c4): the 0x200d-gated two-region state commit.
// The record-only dispatch cannot know 0x15c5's carry result, so tests that need the "found"
// (carry-set) arm override m.call to set carry when 0x15c5 is dispatched -- simulating a nonzero
// region. Pins both arms (else = 0x3ea4 scan, if = 0x2524 scan + 0x18f1 pulse), the shared
// loc_15a9 commit writes (0x200d/0x2008/0x2007), the rnc early-out, T-states, and m.calls.
//
// Run: node --test games/invaders/translated/test/loc_1597.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1597 } from "../loc_1597.js";

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
// Override that also simulates loc_15c5 returning "found" (carry set) so the rnc falls through.
function carryOn15c5(m) {
  m.call = (addr) => { m.calls.push(addr); if (addr === 0x15c5) m.regs.f |= 0x01; return undefined; };
}

test("loc_1597: else arm (0x200d==0), scan reports found -> commit via loc_15a9; 140 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; carryOn15c5(m);
  m.mem.write8(0x200d, 0x00);
  m.mem.write8(0x200e, 0x5c);

  loc_1597(m);

  assert.equal(m.regs.hl, 0x3ea4, "else arm scans region 0x3ea4");
  assert.equal(m.mem.read8(0x200d), 0x01, "(0x200d) := A (0x01 from mvi a,0x01)");
  assert.equal(m.mem.read8(0x2008), 0xfe, "(0x2008) := B (0xfe from mvi b,0xfe)");
  assert.equal(m.mem.read8(0x2007), 0x5c, "(0x2007) := mem[0x200e]");
  assert.equal(m.regs.b, 0xfe, "B := 0xfe");
  assert.equal(m.regs.a, 0x5c, "A ends holding the 0x200e load");
  assert.deepEqual(m.calls, [0x15c5], "only the 0x15c5 scan is dispatched on the else arm");
  assert.equal(m.pc, 0x15a4, "ret pops the 0x15a4 return pushed by `call 0x15c5`");
  assert.equal(m.tstates, 140, "13+4+10+10+17+5+7+7+13+5+13+13+13+10 = 140 T");
});

test("loc_1597: if arm (0x200d!=0), scan found -> 0x18f1 pulse, xra a, commit; 157 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; carryOn15c5(m);
  m.mem.write8(0x200d, 0x03);
  m.mem.write8(0x200e, 0x7a);
  m.regs.b = 0x99;

  loc_1597(m);

  assert.equal(m.regs.hl, 0x2524, "if arm scans region 0x2524");
  assert.equal(m.mem.read8(0x200d), 0x00, "(0x200d) := A (0x00 from xra a)");
  assert.equal(m.mem.read8(0x2008), 0x99, "(0x2008) := B (untouched 0x99)");
  assert.equal(m.mem.read8(0x2007), 0x7a, "(0x2007) := mem[0x200e]");
  assert.deepEqual(m.calls, [0x15c5, 0x18f1], "0x15c5 scan then the 0x18f1 pulse");
  assert.equal(m.pc, 0x15c1, "ret pops the 0x15c1 return pushed by `call 0x18f1`");
  assert.equal(m.tstates, 157, "if-arm through loc_15b7 then loc_15a9 commit");
});

test("loc_1597: else arm, scan reports clear (carry clear) -> rnc early bail; 65 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; // default record-only call leaves carry clear (region 'clear')
  m.mem.write8(0x200d, 0x00);

  loc_1597(m);

  assert.equal(m.mem.read8(0x200d), 0x00, "no commit -- 0x200d untouched by the routine");
  assert.equal(m.mem.read8(0x2008), 0x00, "no commit -- 0x2008 untouched");
  assert.deepEqual(m.calls, [0x15c5], "only the scan ran before rnc bailed");
  assert.equal(m.pc, 0x15a4, "rnc pops the 0x15a4 return pushed by `call 0x15c5`");
  assert.equal(m.tstates, 65, "13+4+10+10+17+11 = 65 T");
});

test("loc_1597 MUTATION: taken rnc mis-charged 5T (not 11T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400;
  m.mem.write8(0x200d, 0x00);
  const realRet = m.ret.bind(m);
  m.ret = (c) => realRet(5); // mutant: not-taken rnc value on the taken arm
  loc_1597(m);
  assert.equal(m.tstates, 59, "mutation loses 6 T (11 -> 5)");
  assert.notEqual(m.tstates, 65, "golden T-state total catches the mutant");
});
