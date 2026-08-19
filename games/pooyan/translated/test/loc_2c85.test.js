// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2c85. Run: node --test .../loc_2c85.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2c85 } from "../loc_2c85.js";

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

test("loc_2c85 state == 0x11 -> advance to 0x12, seed script ptr 0x2d00; 164 T", () => {
  const m = mk(); m.mem.write8(0x8a82, 0x11);
  loc_2c85(m); assert.equal(m.tstates, 164, "T"); assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.mem.read8(0x8a82), 0x12); assert.equal(m.mem.read8(0x8a96), 0x00, "(ix+0x16)=low(0x2d00)");
  assert.equal(m.mem.read8(0x8a97), 0x2d, "(ix+0x17)=high(0x2d00)");
});
test("loc_2c85 state != 0x11 -> ret nz; 37 T", () => {
  const m = mk(); m.mem.write8(0x8a82, 0x05);
  loc_2c85(m); assert.equal(m.tstates, 37, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2c85 MUTATION: ld (ix+0x02),0x12 mis-charged 13T (not 19T)", () => {
  const m = mk(); m.mem.write8(0x8a82, 0x11);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2c8f ? 13 : c);
  loc_2c85(m); assert.notEqual(m.tstates, 164);
});