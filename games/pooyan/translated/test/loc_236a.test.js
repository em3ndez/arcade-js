// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_236a (ROM 0x236a-0x23a0). Run: node --test .../loc_236a.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_236a } from "../loc_236a.js";

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

test("loc_236a: bit3 set, no clamp, script!=0xf6 -> phase tail via loc_2405/loc_23a1; 182 T", () => {
  const m = makeMachine(); seat(m);
  m.regs.ix = 0x8a80;
  m.mem.write8(0x8a87, 0x08); // (ix+7) bit3 set
  m.mem.write8(0x8a84, 0x50); // (ix+4)
  m.mem.write8(0x88be, 0x00); // script byte != 0xf6
  loc_236a(m);
  assert.equal(m.tstates, 182, "T");
  assert.equal(m.pc, CR, "ret");
  assert.equal(m.mem.read8(0x8a84), 0x51, "(ix+4) advanced");
  assert.deepEqual(m.calls, [0x23d7, 0x2405, 0x23a1], "helpers + fall into loc_23a1");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_236a: (ix+7) bit3 clear -> ret z immediately; 31 T", () => {
  const m = makeMachine(); seat(m);
  m.regs.ix = 0x8a80;
  m.mem.write8(0x8a87, 0x00);
  loc_236a(m);
  assert.equal(m.tstates, 31, "T");
  assert.deepEqual(m.calls, [], "no work");
  assert.deepEqual(m.pcSeq, [0x236e, CR], "gate then ret");
});

test("loc_236a: high clamp -> (ix+4) held at 0xc0", () => {
  const m = makeMachine(); seat(m);
  m.regs.ix = 0x8a80;
  m.mem.write8(0x8a87, 0x08);
  m.mem.write8(0x8a84, 0xc5); // inc -> 0xc6 >= 0xc0 -> clamp
  m.mem.write8(0x88be, 0x00);
  loc_236a(m);
  assert.equal(m.mem.read8(0x8a84), 0xc0, "clamped to 0xc0");
});

test("loc_236a MUTATION: inc (ix+4) mis-charged 19T (not 23T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.regs.ix = 0x8a80;
  m.mem.write8(0x8a87, 0x08); m.mem.write8(0x8a84, 0x50); m.mem.write8(0x88be, 0x00);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x2372 ? 19 : c);
  loc_236a(m);
  assert.notEqual(m.tstates, 182, "golden T catches the mutant");
});
