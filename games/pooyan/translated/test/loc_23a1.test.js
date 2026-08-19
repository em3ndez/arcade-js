// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_23a1 (ROM 0x23a1-0x23ac). Run: node --test .../loc_23a1.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_23a1 } from "../loc_23a1.js";

const CR = 0xabcd;
function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); }, call(a) { this.calls.push(a); this.ret(); return undefined; } };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CR); }

test("loc_23a1: counter stays nonzero -> ret nz; 57 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x88bd, 0x03);
  loc_23a1(m);
  assert.equal(m.tstates, 57, "T");
  assert.equal(m.pc, CR, "ret");
  assert.equal(m.mem.read8(0x88bd), 0x02, "0x88bd decremented");
  assert.deepEqual(m.calls, [], "no fall-through");
});

test("loc_23a1: counter hits 0 -> borrow into 0x88bc, fall into loc_23ad; 78 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x88bd, 0x01); m.mem.write8(0x88bc, 0x05);
  loc_23a1(m);
  assert.equal(m.tstates, 78, "T");
  assert.equal(m.mem.read8(0x88bd), 0x00, "0x88bd -> 0");
  assert.equal(m.mem.read8(0x88bc), 0x04, "0x88bc decremented");
  assert.deepEqual(m.calls, [0x23ad], "delegate to render tail");
});

test("loc_23a1 MUTATION: dec (hl) at 0x23a4 mis-charged 7T (not 11T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x88bd, 0x03);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x23a5 ? 7 : c);
  loc_23a1(m);
  assert.notEqual(m.tstates, 57, "golden T catches the mutant");
});
