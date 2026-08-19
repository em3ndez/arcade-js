// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2e36. Run: node --test .../loc_2e36.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2e36 } from "../loc_2e36.js";

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

test("loc_2e36 inactive cell -> ret c; 37 T", () => {
  const m = mk(); m.regs.ix = 0x8f1c; m.mem.write8(0x8f1c, 0x00);
  loc_2e36(m); assert.equal(m.tstates, 37, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2e36 active -> rst 0x28 dispatch table 0x2e3d; 42 T", () => {
  const m = mk(); m.norec.add(0x0028); m.regs.ix = 0x8f1c; m.mem.write8(0x8f1c, 0x02);
  loc_2e36(m); assert.equal(m.tstates, 42, "T"); assert.equal(m.pc, 0x0028);
  assert.equal(m.regs.a, 0x01, "selector = (ix+0)-1"); assert.equal(m.mem.read16(m.regs.sp), 0x2e3d);
});