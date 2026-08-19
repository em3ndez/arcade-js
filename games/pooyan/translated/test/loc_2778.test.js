// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2778. Run: node --test .../loc_2778.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2778 } from "../loc_2778.js";

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

test("loc_2778: dispatch (0x8f30)&7 via rst 0x28; 31 T", () => {
  const m = mk(); m.mem.write8(0x8f30, 0x02);
  loc_2778(m);
  assert.equal(m.tstates, 31, "T"); assert.equal(m.pc, 0x0028); assert.equal(m.regs.a, 0x02, "selector");
  assert.deepEqual(m.calls, [0x0028]); assert.equal(m.mem.read16(m.regs.sp), 0x277e, "table base pushed");
});
test("loc_2778 MUTATION: and 0x07 mis-charged 4T (not 7T)", () => {
  const m = mk(); m.mem.write8(0x8f30, 0x02);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x277d ? 4 : c);
  loc_2778(m); assert.notEqual(m.tstates, 31);
});