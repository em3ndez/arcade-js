// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_28ad. Run: node --test .../loc_28ad.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_28ad } from "../loc_28ad.js";

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

test("loc_28ad hold counter non-zero -> dec, ret; 49 T", () => {
  const m = mk(); m.mem.write8(0x8f34, 0x03);
  loc_28ad(m); assert.equal(m.tstates, 49, "T"); assert.equal(m.mem.read8(0x8f34), 0x02); assert.deepEqual(m.calls, []);
});
test("loc_28ad hold expired -> advance state, clear record via rst 0x10 + loc_28c5; 131 T", () => {
  const m = mk(); m.mem.write8(0x8f34, 0x00); m.mem.write8(0x8f50, 0); m.mem.write16(0x8f32, 0x8c00);
  loc_28ad(m);
  assert.equal(m.tstates, 131, "T"); assert.deepEqual(m.calls, [0x0010, 0x28c5]); assert.equal(m.mem.read8(0x8f30), 0x01);
});
test("loc_28ad MUTATION: ld hl,(0x8f32) mis-charged 13T (not 16T)", () => {
  const m = mk(); m.mem.write8(0x8f34, 0x00);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x28c2 ? 13 : c);
  loc_28ad(m); assert.notEqual(m.tstates, 131);
});