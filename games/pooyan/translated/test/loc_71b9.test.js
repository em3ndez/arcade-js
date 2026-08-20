// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_71b9 (ROM 0x71b9-0x71c0): the bonus/eagle-phase dispatcher. It pushes the
// shared epilogue 0x02ef FIRST, then the rst-0x28 table base 0x71c1, and rst-0x28 dispatches. The
// selected handler ret's into 0x02ef, so loc_71b9 must RUN loc_02ef after the dispatch (its ret then
// returns to loc_71b9's caller). Omitting that continuation strands 0x02ef and leaks 2 bytes/NMI --
// the NMI epilogue at 0x0713 then ret's through a saved register (same class as loc_159b/loc_15d1).
//
// Run: node --test games/pooyan/translated/test/loc_71b9.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_71b9 } from "../loc_71b9.js";

const CALLER_RET = 0xabcd;
const SP_TOP = 0x8780;

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
    // Faithful stack model of the two callees so the balance tooth is real: rst-0x28 (loc_0028) pops
    // the inline table base, then the selected handler ret's into the pushed epilogue (0x02ef); the
    // 0x02ef continuation (loc_02ef) then ret's to loc_71b9's caller.
    call(addr) {
      this.calls.push(addr);
      if (addr === 0x0028) { this.pop16(); this.pc = this.pop16(); } // trampoline pop + handler ret -> 0x02ef
      else { this.pc = this.pop16(); }                                // loc_02ef ret -> caller
      return undefined;
    },
  };
}
function seatCaller(m) { m.regs.sp = SP_TOP; m.push16(CALLER_RET); }

test("loc_71b9: pushes 0x02ef + table base 0x71c1, dispatches, runs the 0x02ef continuation, balances", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f38, 0x02);

  loc_71b9(m);

  assert.equal(m.tstates, 13 + 10 + 11 + 11, "T = ld a 13 + ld hl 10 + push 11 + rst 11 = 45");
  assert.equal(m.regs.a, 0x02, "A = phase selector (0x8f38)");
  assert.deepEqual(m.pcSeq, [0x71bc, 0x71bf, 0x71c0, 0x0028], "own instruction boundaries");
  assert.deepEqual(m.calls, [0x0028, 0x02ef], "rst-0x28 dispatch THEN the 0x02ef continuation");
  assert.equal(m.mem.read16(0x877a), 0x71c1, "pushed the inline table base 0x71c1");
  assert.equal(m.mem.read16(0x877c), 0x02ef, "pushed the shared epilogue return 0x02ef below it");
  assert.equal(m.regs.sp, SP_TOP, "balanced: handler pops 0x02ef, loc_02ef ret pops the caller");
  assert.equal(m.pc, CALLER_RET, "control returns to loc_71b9's caller via loc_02ef's ret");
});

test("loc_71b9 POSITIVE CONTROL: dropping the 0x02ef continuation strands it and unbalances the stack", () => {
  // Reproduce the pre-fix tail-only shape: push both, dispatch, but DON'T run loc_02ef.
  const m = makeMachine();
  seatCaller(m);
  m.push16(0x02ef); m.push16(0x71c1);
  m.call(0x0028); // trampoline pop + handler ret -> pc=0x02ef, but no continuation call
  assert.notEqual(m.regs.sp, SP_TOP, "without the continuation, the caller ret is left on the stack (leak)");
});

test("loc_71b9 MUTATION: ld hl mischarged 7T is caught by the 45 T golden", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x71bf ? 7 : c);
  loc_71b9(m);
  assert.notEqual(m.tstates, 45, "golden 45 T catches the mischarge");
});
