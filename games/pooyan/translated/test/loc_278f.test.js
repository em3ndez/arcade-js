// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_278f. Run: node --test .../loc_278f.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_278f } from "../loc_278f.js";

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
    ret(c = 10) { this.step(this.pop16(), c); }, call(a) { this.calls.push(a); if (a !== 0x0028) this.ret(); return undefined; },
    ldirAt(self, nextAddr) { const { regs, mem } = this; for (;;) { const b = mem.read8(regs.hl); mem.write8(regs.de, b);
      regs.hl = (regs.hl + 1) & 0xffff; regs.de = (regs.de + 1) & 0xffff; regs.bc = (regs.bc - 1) & 0xffff;
      const n = (regs.a + b) & 0xff; regs.f = (regs.f & 0xc1) | (regs.bc !== 0 ? 0x04 : 0) | (n & 0x08 ? 0x08 : 0) | (n & 0x02 ? 0x20 : 0);
      if (regs.bc === 0) { this.step(nextAddr, 16); return; } regs.f = (regs.f & ~0x28) | ((self >> 8) & 0x28); this.step(self, 21); } } };
  regs.sp = 0x8780; m.push16(CR); return m;
}

test("loc_278f already armed, all gates clear -> tail blit loc_3325; 245 T", () => {
  const m = mk();
  m.mem.write8(0x8f3f, 0x01); m.mem.write8(0x8ab4, 0x50);
  m.mem.write8(0x8c90, 0x00); m.mem.write8(0x8ca8, 0x00); m.mem.write8(0x8806, 0x01); m.mem.write8(0x8d7a, 0x00);
  loc_278f(m);
  assert.equal(m.tstates, 245, "T"); assert.equal(m.pc, CR); assert.deepEqual(m.calls, [0x3325]);
});
test("loc_278f arrow Y below 0x3c -> ret c; 60 T", () => {
  const m = mk(); m.mem.write8(0x8f3f, 0x01); m.mem.write8(0x8ab4, 0x20);
  loc_278f(m);
  assert.equal(m.tstates, 60, "T"); assert.deepEqual(m.calls, []);
});
test("loc_278f hunter-hit bit set -> ret nz", () => {
  const m = mk(); m.mem.write8(0x8f3f, 0x01); m.mem.write8(0x8ab4, 0x50); m.mem.write8(0x8c90, 0x02);
  loc_278f(m); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
});
test("loc_278f MUTATION: cp 0x3c mis-charged 4T (not 7T)", () => {
  const m = mk(); m.mem.write8(0x8f3f, 0x01); m.mem.write8(0x8ab4, 0x20);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x27b7 ? 4 : c);
  loc_278f(m); assert.notEqual(m.tstates, 60);
});