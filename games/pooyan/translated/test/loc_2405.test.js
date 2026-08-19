// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2405 (ROM 0x2405-0x241d). Run: node --test .../loc_2405.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2405 } from "../loc_2405.js";

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
    ret(c = 10) { this.step(this.pop16(), c); }, call(a) { this.calls.push(a); return undefined; } };
}
function seat(m) { m.regs.sp = 0x8780; m.push16(CR); }

test("loc_2405 even frame -> ret z early; 44 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x01); // inc -> 0x02, bit0 clear
  loc_2405(m);
  assert.equal(m.tstates, 44, "T");
  assert.equal(m.pc, CR, "ret");
});

test("loc_2405 odd frame, byte==0x37 -> step to next high byte, reseed 0x34; 122 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x00);   // inc -> 0x01, bit0 set
  m.mem.write16(0x88be, 0x8100);
  m.mem.write8(0x8100, 0x37);
  loc_2405(m);
  assert.equal(m.tstates, 122, "T");
  assert.equal(m.mem.read8(0x8101), 0x34, "next byte reseeded 0x34");
  assert.equal(m.mem.read16(0x88be), 0x8101, "pointer advanced");
});

test("loc_2405 odd frame, byte<0x37 -> inc in place; 124 T", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x00);
  m.mem.write16(0x88be, 0x8100);
  m.mem.write8(0x8100, 0x20);
  loc_2405(m);
  assert.equal(m.tstates, 124, "T");
  assert.equal(m.mem.read8(0x8100), 0x21, "byte incremented");
  assert.equal(m.mem.read16(0x88be), 0x8100, "pointer unchanged");
});

test("loc_2405 MUTATION: bit 0,(hl) mis-charged 8T (not 12T) is caught", () => {
  const m = makeMachine(); seat(m);
  m.mem.write8(0x8f37, 0x00); m.mem.write16(0x88be, 0x8100); m.mem.write8(0x8100, 0x20);
  const real = m.step.bind(m);
  m.step = (n, c) => real(n, n === 0x240b ? 8 : c);
  loc_2405(m);
  assert.notEqual(m.tstates, 124, "golden T catches the mutant");
});
