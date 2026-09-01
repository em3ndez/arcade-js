// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_1581 (ROM 0x1581-0x158f): computed record address. Pins the RLCx3 +
// 3*B + C - 1 into L, the 0x2067 page base into H, exact MAME i8080 T-states, and no delegations.
//
// Run: node --test games/invaders/translated/test/loc_1581.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_1581 } from "../loc_1581.js";

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

test("loc_1581: HL := (0x2067 << 8) | (B*11 + C - 1); 71 T", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(0xcafe);
  m.regs.b = 0x05; m.regs.c = 0x02;
  m.mem.write8(0x2067, 0x25);

  loc_1581(m);

  // A = ((0x05<<3) + 3*0x05 + 0x02) - 1 = (0x28 + 0x0f + 0x02) - 1 = 0x39 - 1 = 0x38, then H load.
  assert.equal(m.regs.l, 0x38, "L := RLCx3(B) + 3B + C - 1");
  assert.equal(m.regs.h, 0x25, "H := mem[0x2067]");
  assert.equal(m.regs.a, 0x25, "A ends holding the 0x2067 load");
  assert.deepEqual(m.calls, [], "no delegations");
  assert.equal(m.pc, 0xcafe, "ret pops the caller return");
  assert.equal(m.tstates, 71, "5+4+4+4+4+4+4+4+5+5+13+5+10 = 71 T");
});

test("loc_1581 MUTATION: one `add b` mis-charged 5T (not 4T) is caught", () => {
  const m = makeMachine();
  m.regs.sp = 0x2400; m.push16(0xcafe);
  m.regs.b = 0x05; m.regs.c = 0x02;
  m.mem.write8(0x2067, 0x25);
  const realStep = m.step.bind(m);
  let bumped = false;
  m.step = (n, c) => { const mc = (!bumped && n === 0x1586) ? (bumped = true, c + 1) : c; realStep(n, mc); };
  loc_1581(m);
  assert.equal(m.tstates, 72, "mutation adds 1 T (4 -> 5)");
  assert.notEqual(m.tstates, 71, "golden T-state total catches the mutant");
});
