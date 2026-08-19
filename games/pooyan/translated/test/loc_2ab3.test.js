// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2ab3. Run: node --test .../loc_2ab3.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2ab3 } from "../loc_2ab3.js";

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

test("loc_2ab3 (ix+0x06) below 0xc0 -> ret c; 140 T", () => {
  const m = mk(); m.mem.write8(0x8a8b, 0x01); m.mem.write8(0x8a86, 0x50);
  loc_2ab3(m); assert.equal(m.tstates, 140, "T"); assert.equal(m.pc, CR);
  assert.equal(m.mem.read8(0x8a86), 0x51, "(ix+0x06) incremented");
});
test("loc_2ab3 (ix+0x06) reaches 0xc0 -> nudge Y, advance state, seed 0x40; 231 T", () => {
  const m = mk(); m.mem.write8(0x8a8b, 0x01); m.mem.write8(0x8a86, 0xbf); m.mem.write8(0x8a84, 0x50);
  loc_2ab3(m);
  assert.equal(m.tstates, 231, "T"); assert.equal(m.mem.read8(0x8a84), 0x4d, "base Y -= 3");
  assert.equal(m.mem.read8(0x8a82), 0x01, "state advanced"); assert.equal(m.mem.read8(0x8a91), 0x40);
});
test("loc_2ab3 MUTATION: inc (ix+0x06) mis-charged 19T (not 23T)", () => {
  const m = mk(); m.mem.write8(0x8a8b, 0x01); m.mem.write8(0x8a86, 0x50);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2ad2 ? 19 : c);
  loc_2ab3(m); assert.notEqual(m.tstates, 140);
});