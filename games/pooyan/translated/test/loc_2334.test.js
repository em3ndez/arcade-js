// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2334 (ROM 0x2334-0x2369). Run: node --test .../loc_2334.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2334 } from "../loc_2334.js";

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

// Path: A>=0x41 (clamp skipped), script low != 0xe6 -> jump to the phase tail, counter stays nonzero
// -> ret nz. Exercises both pattern-A calls (loc_23d7, loc_23ec) and the 0x88bd wrap.
test("loc_2334 main path -> phase bump, ret nz; 173 T", () => {
  const m = makeMachine(); seat(m);
  m.regs.a = 0x50; m.regs.b = 0x10;
  m.mem.write16(0x88be, 0x1234); m.mem.write8(0x88bd, 0x00);
  loc_2334(m);
  assert.equal(m.tstates, 173, "T");
  assert.equal(m.pc, CR, "ret");
  assert.equal(m.regs.b, 0x11, "inc b");
  assert.equal(m.mem.read8(0x88bd), 0x01, "0x88bd bumped & masked");
  assert.deepEqual(m.calls, [0x23d7, 0x23ec], "pattern-A calls");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.pcSeq,
    [0x2335, 0x2337, 0x233d, 0x23d7, 0x2340, 0x2343, 0x2344, 0x2346, 0x2359, 0x23ec,
     0x235c, 0x235f, 0x2360, 0x2361, 0x2363, 0x2364, 0x2365, CR], "boundaries");
});

test("loc_2334 low clamp: A<0x41 -> writes (ix+4)=0x41", () => {
  const m = makeMachine(); seat(m);
  m.regs.ix = 0x8a80; m.regs.a = 0x20; m.regs.b = 0x00;
  m.mem.write16(0x88be, 0x1234); m.mem.write8(0x88bd, 0x00);
  loc_2334(m);
  assert.equal(m.mem.read8(0x8a84), 0x41, "(ix+4) clamped to 0x41");
});

test("loc_2334 MUTATION: cp 0x41 mis-charged 4T (not 7T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.regs.a = 0x50; m.mem.write16(0x88be, 0x1234); m.mem.write8(0x88bd, 0x00);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x2337 ? 4 : c);
  loc_2334(m);
  assert.notEqual(m.tstates, 173, "golden T catches the mutant");
});
