// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_28c6. Run: node --test .../loc_28c6.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_28c6 } from "../loc_28c6.js";

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

test("loc_28c6 (0x8907) bit0 clear -> force state 6, ret; 85 T", () => {
  const m = mk(); m.mem.write8(0x8907, 0x00);
  loc_28c6(m);
  assert.equal(m.tstates, 85, "T"); assert.equal(m.pc, CR); assert.deepEqual(m.calls, [0x2101]);
  assert.equal(m.mem.read8(0x880a), 0x06, "state forced to 6");
});
test("loc_28c6 dispatch: pushes loc_2b8d epilogue, rst 0x28 table 0x28f1; 199 T", () => {
  const m = mk(); m.mem.write8(0x8907, 0x01); m.mem.write8(0x8f08, 0); m.mem.write8(0x8a91, 0x01); m.mem.write8(0x8a82, 0x03);
  loc_28c6(m);
  assert.equal(m.tstates, 199, "T"); assert.equal(m.pc, 0x0028); assert.deepEqual(m.calls, [0x2101, 0x0028]);
  assert.equal(m.mem.read16(m.regs.sp), 0x28f1, "dispatch table base on top");
});
test("loc_28c6 frame delay not expired -> ret nz returns into loc_2b8d; 168 T", () => {
  const m = mk(); m.mem.write8(0x8907, 0x01); m.mem.write8(0x8f08, 0); m.mem.write8(0x8a91, 0x05);
  loc_28c6(m);
  assert.equal(m.tstates, 168, "T"); assert.equal(m.pc, 0x2b8d, "epilogue address popped by ret nz");
  assert.deepEqual(m.calls, [0x2101]);
});
test("loc_28c6 MUTATION: dec (ix+0x11) mis-charged 19T (not 23T)", () => {
  const m = mk(); m.mem.write8(0x8907, 0x01); m.mem.write8(0x8f08, 0); m.mem.write8(0x8a91, 0x01); m.mem.write8(0x8a82, 0x03);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x28ea ? 19 : c);
  loc_28c6(m); assert.notEqual(m.tstates, 199);
});