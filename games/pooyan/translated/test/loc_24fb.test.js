// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_24fb. Run: node --test .../loc_24fb.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_24fb } from "../loc_24fb.js";

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

test("loc_24fb (0x882b)==0 -> write 0x880a, (0x8a3c)==0 -> ret z; 101 T", () => {
  const m = mk(); m.mem.write8(0x8a91, 0x01); m.mem.write8(0x882b, 0x00); m.mem.write8(0x8a3c, 0x00);
  loc_24fb(m);
  assert.equal(m.tstates, 101, "T"); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x880a), 0x07, "flag at 0x880a set"); assert.equal(m.mem.read8(0x882b), 0x00);
});
test("loc_24fb (0x882b)!=0 -> write 0x882b, (0x8a3c)!=0 -> fall into loc_250f; 103 T", () => {
  const m = mk(); m.mem.write8(0x8a91, 0x01); m.mem.write8(0x882b, 0x02); m.mem.write8(0x8a3c, 0x01);
  loc_24fb(m);
  assert.equal(m.tstates, 103, "T"); assert.deepEqual(m.calls, [0x250f]);
  assert.equal(m.mem.read8(0x882b), 0x07, "flag at 0x882b set");
});
test("loc_24fb MUTATION: dec (ix+0x11) mis-charged 19T (not 23T)", () => {
  const m = mk(); m.mem.write8(0x8a91, 0x01);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x24fe ? 19 : c);
  loc_24fb(m); assert.notEqual(m.tstates, 101);
});