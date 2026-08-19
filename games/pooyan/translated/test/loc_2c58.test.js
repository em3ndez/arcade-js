// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2c58. Run: node --test .../loc_2c58.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2c58 } from "../loc_2c58.js";

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

test("loc_2c58 climbing (high byte < 0x12) -> ret c, returns true; 137 T", () => {
  const m = mk(); m.mem.write8(0x8a86, 0x05);
  const r = loc_2c58(m); assert.equal(r, true); assert.equal(m.tstates, 137, "T"); assert.deepEqual(m.calls, [0x4006]);
});
test("loc_2c58 reaches top (>= 0x12) -> sweep 0x11 records, pop af; ret false; 1299 T", () => {
  const m = mk(); m.mem.write8(0x8a85, 0x00); m.mem.write8(0x8a89, 0x00); m.mem.write8(0x8a86, 0x12);
  const r = loc_2c58(m); assert.equal(r, false); assert.equal(m.tstates, 1299, "T");
  assert.equal(m.calls.length, 19, "4006 + 17x 2c85 + 0f3f");
});
test("loc_2c58 MUTATION: add a,(ix+0x09) mis-charged 15T (not 19T)", () => {
  const m = mk(); m.mem.write8(0x8a86, 0x05);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2c61 ? 15 : c);
  loc_2c58(m); assert.notEqual(m.tstates, 137);
});