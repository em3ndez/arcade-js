// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6da6 (ROM 0x6da6-0x6da9): the level-intro phase dispatcher.
// Flat-RAM mock (real Regs). rst 0x28 is a TAIL dispatch: no handler-return is pushed first, so the
// only thing on the stack below the pushed table base is the caller's return -- the selected handler
// ret's straight to loc_6da6's caller. We assert the table base 0x6daa is pushed and control tails
// into loc_0028.
//
// Run: node --test games/pooyan/translated/test/loc_6da6.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6da6 } from "../loc_6da6.js";

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
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6da6: reads (0x8f51), pushes table base 0x6daa, tails into loc_0028; 24 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f51, 0x03);

  loc_6da6(m);

  assert.equal(m.tstates, 13 + 11, "T = ld a,(nn) 13 + rst 11");
  assert.equal(m.regs.a, 0x03, "A = phase selector (0x8f51)");
  assert.equal(m.pc, 0x0028, "tail into the rst-0x28 trampoline");
  assert.deepEqual(m.pcSeq, [0x6da9, 0x0028], "boundaries");
  assert.deepEqual(m.calls, [0x0028], "delegates to loc_0028");
  assert.equal(m.regs.sp, 0x877c, "table base was pushed (caller ret still below it)");
  assert.equal(m.mem.read16(0x877c), 0x6daa, "pushed inline table base 0x6daa");
});

test("loc_6da6 MUTATION: ld a,(nn) mischarged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6da9 ? 7 : c);
  loc_6da6(m);
  assert.notEqual(m.tstates, 24, "golden 24 T catches the mischarge");
});
