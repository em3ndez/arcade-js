// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2563. Run: node --test .../loc_2563.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2563 } from "../loc_2563.js";

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

test("loc_2563 (0x8f50) busy -> ret nz; 28 T", () => {
  const m = mk(); m.mem.write8(0x8f50, 0x01); loc_2563(m);
  assert.equal(m.tstates, 28); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
});
test("loc_2563 holding -> dec (0x8f06), ret; 71 T", () => {
  const m = mk(); m.mem.write8(0x8f50, 0); m.mem.write8(0x8f06, 0x05); loc_2563(m);
  assert.equal(m.tstates, 71, "T"); assert.equal(m.mem.read8(0x8f06), 0x04); assert.deepEqual(m.calls, []);
});
test("loc_2563 expire, (0x8907) bit0 clear, phase odd -> DE=0x2748, two blits; 290 T", () => {
  const m = mk(); m.mem.write8(0x8f50, 0); m.mem.write8(0x8f06, 0); m.mem.write8(0x8f07, 0); m.mem.write8(0x8907, 0x00);
  loc_2563(m);
  assert.equal(m.tstates, 290, "T"); assert.equal(m.mem.read8(0x8f06), 0x0c, "reload"); assert.equal(m.mem.read8(0x8f07), 0x01, "phase++");
  assert.equal(m.regs.de, 0x2748); assert.equal(m.regs.hl, 0x845b, "second blit one row up");
  assert.deepEqual(m.calls, [0x3325, 0x3325]);
});
test("loc_2563 expire, (0x8907) bit0 set -> DE=0x2750, HL page 0x87", () => {
  const m = mk(); m.mem.write8(0x8f50, 0); m.mem.write8(0x8f06, 0); m.mem.write8(0x8f07, 0); m.mem.write8(0x8907, 0x01);
  loc_2563(m);
  assert.equal(m.tstates, 276, "T"); assert.equal(m.regs.de, 0x2750); assert.equal(m.regs.hl, 0x875b);
});
test("loc_2563 MUTATION: ex de,hl mis-charged 8T (not 4T)", () => {
  const m = mk(); m.mem.write8(0x8f50, 0); m.mem.write8(0x8f06, 0); m.mem.write8(0x8f07, 0); m.mem.write8(0x8907, 0x00);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2576 ? 8 : c);
  loc_2563(m); assert.notEqual(m.tstates, 290);
});