// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6df9 (ROM 0x6df9-0x6e56): the ANTI-TAMPER clone of loc_0ac8. Being a
// byte-for-byte duplicate, it must behave identically to loc_0ac8; here we pin the two early-return
// timer paths. loc_09f8 is a plain-ret callee (pattern-A) so the stub runs m.ret().
//
// Run: node --test games/pooyan/translated/test/loc_6df9.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6df9 } from "../loc_6df9.js";

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
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6df9: (0x8d41)!=1 skips 0x0a28, (0x8e50) tick returns; 92 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d41, 0x02); // dec -> 1 (nz): skip the 0x0a28 wrap call
  m.mem.write8(0x8e50, 0x02); // dec -> 1 (nz): ret nz

  loc_6df9(m);

  assert.equal(m.tstates, 10 + 11 + 12 + 17 + 10 + 10 + 11 + 11, "92 T");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
  assert.equal(m.mem.read8(0x8d41), 0x01, "(0x8d41) decremented");
  assert.equal(m.mem.read8(0x8e50), 0x01, "(0x8e50) decremented");
  assert.deepEqual(m.calls, [0x09f8], "only the scripted-step call (0x0a28 skipped)");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq, [0x6dfc, 0x6dfd, 0x6e02, 0x09f8, 0x6e05, 0x6e08, 0x6e09, CALLER_RET], "boundaries");
});

test("loc_6df9: (0x8d41)==1 runs the 0x0a28 wrap call", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d41, 0x01); // dec -> 0 (z): take the 0x0a28 call
  m.mem.write8(0x8e50, 0x02);

  loc_6df9(m);

  assert.deepEqual(m.calls, [0x0a28, 0x09f8], "both the wrap call and the scripted-step call");
  assert.equal(m.pc, CALLER_RET, "ret nz returns to caller");
});

test("loc_6df9 MUTATION: dec (hl) at 0x6dfd mischarged 7T (not 11T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8d41, 0x02);
  m.mem.write8(0x8e50, 0x02);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x6dfd ? 7 : c);
  loc_6df9(m);
  assert.notEqual(m.tstates, 92, "golden 92 T catches the mischarge");
});
