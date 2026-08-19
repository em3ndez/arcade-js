// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2514. Run: node --test .../loc_2514.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2514 } from "../loc_2514.js";

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

test("loc_2514: copy 4 tiles by 0x18 stride, tail ret; 282 T", () => {
  const m = mk(); m.regs.de = 0x18; m.regs.b = 0x04; m.regs.hl = 0x9000;
  for (let i = 0; i < 4; i++) m.mem.write8(0x9000 + i, 0xa0 + i);
  m.mem.write8(0x8df9, 0); m.mem.write8(0x89e5, 0);
  loc_2514(m);
  assert.equal(m.tstates, 282, "T"); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8a8f), 0xa0, "record 0 tile");
  assert.equal(m.mem.read8(0x8a80 + 0x18 * 2 + 0x0f), 0xa2, "record 2 tile");
  assert.equal(m.regs.hl, 0x89e5, "HL reused for the (0x8df9)|(0x89e5) test");
});
test("loc_2514: (0x8df9)|(0x89e5) nonzero -> jr into loc_2527; 287 T", () => {
  const m = mk(); m.regs.de = 0x18; m.regs.b = 0x04; m.regs.hl = 0x9000; m.mem.write8(0x8df9, 0x01);
  loc_2514(m);
  assert.equal(m.tstates, 287, "T"); assert.deepEqual(m.calls, [0x2527]);
});
test("loc_2514 MUTATION: add ix,de mis-charged 11T (not 15T)", () => {
  const m = mk(); m.regs.de = 0x18; m.regs.b = 0x04; m.regs.hl = 0x9000; m.mem.write8(0x8df9, 0);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x251b ? 11 : c);
  loc_2514(m); assert.notEqual(m.tstates, 282);
});