// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_23ec (ROM 0x23ec-0x2404). Run: node --test .../loc_23ec.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_23ec } from "../loc_23ec.js";

const CALLER_RET = 0xabcd;
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
    ret(c = 10) { this.step(this.pop16(), c); }, call(a) { this.calls.push(a); return undefined; } };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_23ec odd frame -> ret nz early; 44 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x00); // inc -> 0x01, bit0 set
  loc_23ec(m);
  assert.equal(m.tstates, 44, "T");
  assert.equal(m.pc, CALLER_RET, "ret");
  assert.equal(m.mem.read8(0x8f37), 0x01, "frame counter bumped");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
});

test("loc_23ec even frame, byte==0x34 -> reload 0x10 + back up pointer; 122 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x01);   // inc -> 0x02, bit0 clear
  m.mem.write16(0x88be, 0x8100); // script pointer
  m.mem.write8(0x8100, 0x34);
  loc_23ec(m);
  assert.equal(m.tstates, 122, "T");
  assert.equal(m.pc, CALLER_RET, "ret");
  assert.equal(m.mem.read8(0x8100), 0x10, "byte reloaded to 0x10");
  assert.equal(m.mem.read16(0x88be), 0x80ff, "pointer high byte backed up");
  assert.deepEqual(m.pcSeq, [0x23ef, 0x23f0, 0x23f2, 0x23f3, 0x23f6, 0x23f7, 0x23f9, 0x23fe, 0x2400, 0x2401, 0x2404, CALLER_RET], "boundaries");
});

test("loc_23ec even frame, byte!=0x34 -> dec in place; 124 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x01);
  m.mem.write16(0x88be, 0x8100);
  m.mem.write8(0x8100, 0x20);
  loc_23ec(m);
  assert.equal(m.tstates, 124, "T");
  assert.equal(m.mem.read8(0x8100), 0x1f, "byte decremented");
  assert.equal(m.mem.read16(0x88be), 0x8100, "pointer unchanged");
});

test("loc_23ec MUTATION: ld hl,(0x88be) mis-charged 13T (not 16T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x01); m.mem.write16(0x88be, 0x8100); m.mem.write8(0x8100, 0x20);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x23f6 ? 13 : c);
  loc_23ec(m);
  assert.notEqual(m.tstates, 124, "golden T catches the mutant");
});
