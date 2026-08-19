// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2e45. Run: node --test .../loc_2e45.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2e45 } from "../loc_2e45.js";

const CR = 0xabcd;
function mk() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], norec: new Set(),
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(a) { this.calls.push(a); if (this.norec.has(a)) return undefined; this.ret(); return true; } };
  regs.sp = 0x8780; m.push16(CR); regs.ix = 0x8a80; return m;
}

test("loc_2e45: dec timer 0x8f28 + 2*(IXL&3); 62 T", () => {
  const m = mk(); m.regs.ix = 0x8f1e; m.mem.write8(0x8f2c, 0x05); // IXL&3 = 2 -> 0x8f28+4
  loc_2e45(m); assert.equal(m.tstates, 62, "T"); assert.equal(m.mem.read8(0x8f2c), 0x04);
  assert.equal(m.regs.c, 0x1e, "C = IXL");
});
test("loc_2e45 MUTATION: ld a,ixl mis-charged 4T (not 8T)", () => {
  const m = mk(); m.regs.ix = 0x8f1e;
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2e47 ? 4 : c);
  loc_2e45(m); assert.notEqual(m.tstates, 62);
});