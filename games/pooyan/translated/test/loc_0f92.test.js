// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0f92 (ROM 0x0f92-0x0f96): the command-0x1d trampoline. Loads A=0x1d and
// tail-jumps to the 0x0fc3 dispatcher; the dispatcher's ret returns to loc_0f92's caller (frame reuse,
// so the stack is balanced).
//
// Run: node --test games/pooyan/translated/test/loc_0f92.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0f92 } from "../loc_0f92.js";

const CALLER_RET = 0xabcd;
const SP_TOP = 0x8780;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    // Tail dispatcher: the 0x0fc3 callee ret's to loc_0f92's caller (pops CALLER_RET), so a frame-reuse
    // tail balances the stack back to baseline.
    call(addr) { this.calls.push(addr); this.pc = this.pop16(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = SP_TOP; m.push16(CALLER_RET); }

test("loc_0f92: A=0x1d, tail-jumps to 0x0fc3, ret's to caller, balanced; 17 T", () => {
  const m = makeMachine();
  seatCaller(m);

  loc_0f92(m);

  assert.equal(m.regs.a, 0x1d, "command 0x1d loaded");
  assert.equal(m.tstates, 7 + 10, "T = ld a 7 + jp 10 = 17");
  assert.deepEqual(m.pcSeq, [0x0f94, 0x0fc3], "boundaries: after ld a, then the jp target");
  assert.deepEqual(m.calls, [0x0fc3], "tail-dispatches to 0x0fc3");
  assert.equal(m.pc, CALLER_RET, "the dispatcher ret's to loc_0f92's caller");
  assert.equal(m.regs.sp, SP_TOP, "frame-reuse tail -> stack balanced");
});

test("loc_0f92 MUTATION: ld a mischarged 4T (not 7T) is caught by the 17 T golden", () => {
  const m = makeMachine();
  seatCaller(m);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x0f94 ? 4 : c);
  loc_0f92(m);
  assert.notEqual(m.tstates, 17, "golden 17 T catches the mischarge");
});
