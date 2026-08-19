// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_29a0. Run: node --test .../loc_29a0.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_29a0 } from "../loc_29a0.js";

const CR = 0xabcd;
function mk() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); }, call(a) { this.calls.push(a); this.ret(); return undefined; },
    ldirAt(self, nextAddr) { const { regs, mem } = this; for (;;) { const b = mem.read8(regs.hl); mem.write8(regs.de, b);
      regs.hl = (regs.hl + 1) & 0xffff; regs.de = (regs.de + 1) & 0xffff; regs.bc = (regs.bc - 1) & 0xffff;
      const n = (regs.a + b) & 0xff; regs.f = (regs.f & 0xc1) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
      if (regs.bc === 0) { this.step(nextAddr, 16); return; } regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28); this.step(self, 21); } } };
  regs.sp = 0x8780; m.push16(CR); regs.ix = 0x8a80; return m;
}

test("loc_29a0 (ix+0x06) stays >= 0x2c -> ret nc; 143 T", () => {
  const m = mk(); m.mem.write8(0x8a8b, 0x01); m.mem.write8(0x8a86, 0x40);
  loc_29a0(m); assert.equal(m.tstates, 143, "T"); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8a86), 0x3e, "(ix+0x06) -= 2");
});
test("loc_29a0 drops below 0x2c, (0x8343)==0 -> checksum guard re-enters loc_2ab3; 1415 T", () => {
  const m = mk(); m.mem.write8(0x8a8b, 0x03); m.mem.write8(0x8a86, 0x2c); m.mem.write8(0x8343, 0);
  loc_29a0(m); assert.equal(m.tstates, 1415, "T"); assert.deepEqual(m.calls, [0x2ab3]);
});
test("loc_29a0 below 0x2c, (0x8343)!=0 -> loc_2b23", () => {
  const m = mk(); m.mem.write8(0x8a8b, 0x03); m.mem.write8(0x8a86, 0x2c); m.mem.write8(0x8343, 0x01);
  loc_29a0(m); assert.deepEqual(m.calls, [0x2b23]);
});
test("loc_29a0 MUTATION: inc (ix+0x0b) mis-charged 19T (not 23T)", () => {
  const m = mk(); m.mem.write8(0x8a8b, 0x01); m.mem.write8(0x8a86, 0x40);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x29a7 ? 19 : c);
  loc_29a0(m); assert.notEqual(m.tstates, 143);
});