// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2442. Run: node --test .../loc_2442.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2442 } from "../loc_2442.js";

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

test("loc_2442 active -> ret nz early; 42 T", () => {
  const m = mk(); m.mem.write8(0x89e8, 0x01);
  loc_2442(m);
  assert.equal(m.tstates, 42); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
});
test("loc_2442 idle both zero -> snapshot ldir + shape load + loc_0fad; 748 T", () => {
  const m = mk();
  m.mem.write8(0x8a84, 0x50); m.mem.write8(0x8f24, 0x00);
  for (let i = 0; i < 0x18; i++) m.mem.write8(0x8a80 + i, 0x30 + i);
  loc_2442(m);
  assert.equal(m.tstates, 748, "T"); assert.equal(m.pc, CR);
  assert.deepEqual(m.calls, [0x250f, 0x0fad], "shape load + 0x0fad");
  assert.equal(m.mem.read8(0x8a98), 0x30, "record snapshot copied");
  assert.equal(m.mem.read8(0x8a84), 0x24, "base Y (0x34) dropped by 0x10");
  assert.equal(m.regs.sp, 0x8780, "balanced");
});
test("loc_2442 MUTATION: inc (ix+0x02) mis-charged 19T (not 23T)", () => {
  const m = mk(); m.mem.write8(0x8a84, 0x50);
  for (let i = 0; i < 0x18; i++) m.mem.write8(0x8a80 + i, 0x30 + i);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2451 ? 19 : c);
  loc_2442(m); assert.notEqual(m.tstates, 748);
});