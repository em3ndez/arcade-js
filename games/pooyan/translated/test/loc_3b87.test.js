// SPDX-License-Identifier: GPL-3.0-only
// Equivalence tests for loc_3b87 (ROM 0x3b87-0x3bd0). Flat-RAM mock (real Regs). Tail delegations
// (jp 0x39ba / jp 0x39e0 / jp 0x381e) and the conditional call 0x3553 are modelled by a stub that
// records the target and runs m.ret() so the stack discipline is exercised.
// Run: node --test games/pooyan/translated/test/loc_3b87.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_3b87 } from "../loc_3b87.js";

const CALLER_RET = 0xabcd;
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
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
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); m.regs.ix = 0x8c00; }

test("loc_3b87 Path A: (ix+8) bit0 set -> tail to 0x39ba; 40 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c08, 0x01); // (ix+8) bit0 set
  loc_3b87(m);
  assert.equal(m.tstates, 40, "bit(20)+jp nz(10)+stub ret(10)");
  assert.deepEqual(m.calls, [0x39ba], "delegated to 0x39ba");
  assert.equal(m.pc, CALLER_RET, "tail ret to caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_3b87 Path B: retire at position 0x1d -> tail to 0x381e; 330 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c08, 0x00); // (ix+8) bit0 clear -> travel branch
  m.mem.write8(0x8c03, 0x00); // (ix+3) sub-pos
  m.mem.write8(0x8c0a, 0x00); // (ix+0x0a) velocity -> no carry
  m.mem.write8(0x8c04, 0x1d); // (ix+4) integer pos = 0x1d (reaches retire threshold)
  m.mem.write8(0x8c07, 0x02); // (ix+7) != 0 -> skip the 0x3bca land test
  loc_3b87(m);
  assert.equal(m.tstates, 330, "retire path total");
  assert.deepEqual(m.calls, [0x381e], "queues retire animation via 0x381e");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.mem.read8(0x8c01), 0x01, "(ix+1) set on retire");
  assert.equal(m.mem.read8(0x8c09), 0x20, "(ix+9) := 0x20 on retire");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_3b87 MUTATION: res 0,(ix+8) mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8c04, 0x1d); m.mem.write8(0x8c07, 0x02);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x3bbd ? 19 : c); // 0x3bbd = landing after res 0,(ix+8)
  loc_3b87(m);
  assert.notEqual(m.tstates, 330, "golden total catches the 4T undercharge");
  assert.equal(m.tstates, 326);
});
