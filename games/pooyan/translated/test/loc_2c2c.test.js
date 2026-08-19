// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2c2c. Run: node --test .../loc_2c2c.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2c2c } from "../loc_2c2c.js";

const CR = 0xabcd;
function mk() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = { read8: (a) => ram[a & 0xffff], write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; } };
  const m = { regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [], skip: new Set(),
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    // callers that pushed a return use the boolean protocol: a skip target pops that return, then rets
    call(a) { this.calls.push(a); if (this.skip.has(a)) { this.pop16(); this.ret(); return false; } this.ret(); return true; } };
  regs.sp = 0x8780; m.push16(CR); regs.ix = 0x8a80; return m;
}

test("loc_2c2c full loop (loc_2c3f true 0x11x) -> ret; 1107 T", () => {
  const m = mk();
  loc_2c2c(m); assert.equal(m.tstates, 1107, "T"); assert.equal(m.pc, CR);
  assert.equal(m.calls.length, 0x11); assert.equal(m.regs.ix & 0xffff, (0x8ae0 + 0x18 * 0x11) & 0xffff);
});
test("loc_2c2c loc_2c3f caller-skip -> abort", () => {
  const m = mk(); m.skip.add(0x2c3f);
  loc_2c2c(m); assert.equal(m.calls.length, 1); assert.equal(m.pc, CR);
});
test("loc_2c2c MUTATION: exx mis-charged 8T (not 4T)", () => {
  const m = mk();
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2c36 ? 8 : c);
  loc_2c2c(m); assert.notEqual(m.tstates, 1107);
});