// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2c3f. Run: node --test .../loc_2c3f.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2c3f } from "../loc_2c3f.js";

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

test("loc_2c3f inactive slot -> ret nc, returns true; 53 T", () => {
  const m = mk(); m.mem.write8(0x8a80, 0x00); m.mem.write8(0x8a81, 0x00);
  const r = loc_2c3f(m); assert.equal(r, true); assert.equal(m.tstates, 53, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2c3f state below 0x11 -> ret c, returns true; 91 T", () => {
  const m = mk(); m.mem.write8(0x8a80, 0x01); m.mem.write8(0x8a82, 0x05);
  const r = loc_2c3f(m); assert.equal(r, true); assert.equal(m.tstates, 91, "T");
});
test("loc_2c3f active + state>=0x11 -> rst 0x28 dispatch (table 0x2c50)", () => {
  const m = mk(); m.call = (a) => { m.calls.push(a); return undefined; };
  m.mem.write8(0x8a80, 0x01); m.mem.write8(0x8a82, 0x11);
  loc_2c3f(m); assert.equal(m.pc, 0x0028); assert.deepEqual(m.calls, [0x0028]);
  assert.equal(m.mem.read16(m.regs.sp), 0x2c50, "dispatch table base");
});
test("loc_2c3f MUTATION: sub 0x11 mis-charged 4T (not 7T)", () => {
  const m = mk(); m.mem.write8(0x8a80, 0x01); m.mem.write8(0x8a82, 0x05);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2c4e ? 4 : c);
  loc_2c3f(m); assert.notEqual(m.tstates, 91);
});