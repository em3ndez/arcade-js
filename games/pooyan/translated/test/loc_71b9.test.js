// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_71b9 (ROM 0x71b9-0x71c0): the bonus/eagle-phase dispatcher. Unlike the
// tail-dispatch loc_6da6, this one pushes the shared epilogue 0x02ef FIRST, then the rst-0x28 table
// base 0x71c1 -- so the stack has [table base][0x02ef][caller ret] and the handler ret's into 0x02ef.
//
// Run: node --test games/pooyan/translated/test/loc_71b9.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_71b9 } from "../loc_71b9.js";

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

test("loc_71b9: pushes epilogue 0x02ef + table base 0x71c1, tails into loc_0028; 45 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f38, 0x02);

  loc_71b9(m);

  assert.equal(m.tstates, 13 + 10 + 11 + 11, "T = ld a 13 + ld hl 10 + push 11 + rst 11");
  assert.equal(m.regs.a, 0x02, "A = phase selector (0x8f38)");
  assert.equal(m.pc, 0x0028, "tail into the rst-0x28 trampoline");
  assert.deepEqual(m.pcSeq, [0x71bc, 0x71bf, 0x71c0, 0x0028], "boundaries");
  assert.deepEqual(m.calls, [0x0028], "delegates to loc_0028");
  assert.equal(m.regs.sp, 0x877a, "two words pushed above the caller ret");
  assert.equal(m.mem.read16(0x877a), 0x71c1, "top of stack = inline table base 0x71c1");
  assert.equal(m.mem.read16(0x877c), 0x02ef, "below it = shared epilogue return 0x02ef");
});

test("loc_71b9 MUTATION: push hl mischarged (11->10?) -- ld hl mischarged 7T is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x71bf ? 7 : c);
  loc_71b9(m);
  assert.notEqual(m.tstates, 45, "golden 45 T catches the mischarge");
});
