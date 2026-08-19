// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_27f3. Run: node --test .../loc_27f3.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_27f3 } from "../loc_27f3.js";

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

test("loc_27f3 arrow Y<0x34, free slot -> advance state, loc_0f05+loc_3325; 316 T", () => {
  const m = mk(); m.mem.write8(0x8ab4, 0x20); m.mem.write8(0x8c90, 0x00); m.mem.write8(0x8a86, 0x30);
  loc_27f3(m);
  assert.equal(m.tstates, 316, "T"); assert.deepEqual(m.calls, [0x0f05, 0x3325]);
  assert.equal(m.mem.read8(0x8f30), 0x02, "state advanced");
  assert.equal(m.mem.read8(0x8a9e), 0x3c, "hunter Y = (0x8a86)+0x0c");
});
test("loc_27f3 arrow Y<0x34, no free slot -> ret; 148 T", () => {
  const m = mk(); m.mem.write8(0x8ab4, 0x20); m.mem.write8(0x8c90, 0x11); m.mem.write8(0x8c90 + 0x18, 0x22);
  loc_27f3(m); assert.equal(m.tstates, 148, "T"); assert.deepEqual(m.calls, []);
});
test("loc_27f3 arrow Y>=0x34, flip counter expires -> tail blit; 144 T", () => {
  const m = mk(); m.mem.write8(0x8ab4, 0x40); m.mem.write8(0x892f, 0x01); m.mem.write8(0x892e, 0x00);
  loc_27f3(m);
  assert.equal(m.tstates, 144, "T"); assert.deepEqual(m.calls, [0x3325]); assert.equal(m.regs.de, 0x2d51);
});
test("loc_27f3 arrow Y>=0x34, flip counter not expired -> ret nz; 59 T", () => {
  const m = mk(); m.mem.write8(0x8ab4, 0x40); m.mem.write8(0x892f, 0x05);
  loc_27f3(m); assert.equal(m.tstates, 59, "T"); assert.deepEqual(m.calls, []);
});
test("loc_27f3 MUTATION: ld (0x8f30),a mis-charged 10T (not 13T)", () => {
  const m = mk(); m.mem.write8(0x8ab4, 0x20); m.mem.write8(0x8c90, 0x00);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2828 ? 10 : c);
  loc_27f3(m); assert.notEqual(m.tstates, 316);
});