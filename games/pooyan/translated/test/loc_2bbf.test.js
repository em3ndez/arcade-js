// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2bbf. Run: node --test .../loc_2bbf.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2bbf } from "../loc_2bbf.js";

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

test("loc_2bbf A==1 -> delegates loc_2bd3, returns true; 39 T", () => {
  const m = mk(); m.regs.a = 0x01;
  const r = loc_2bbf(m); assert.equal(r, true); assert.equal(m.tstates, 39, "T"); assert.deepEqual(m.calls, [0x2bd3]);
});
test("loc_2bbf tile==0xba -> pop af; ret caller-skip, returns false; 65 T", () => {
  const m = mk(); m.regs.a = 0x00; m.mem.write8(0x877b, 0xba);
  const r = loc_2bbf(m); assert.equal(r, false); assert.equal(m.tstates, 65, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2bbf else -> blit loc_3325 + loc_2bd3, returns true; 97 T", () => {
  const m = mk(); m.regs.a = 0x00; m.mem.write8(0x877b, 0x00);
  const r = loc_2bbf(m); assert.equal(r, true); assert.equal(m.tstates, 97, "T"); assert.deepEqual(m.calls, [0x3325, 0x2bd3]);
});
test("loc_2bbf MUTATION: cp 0xba mis-charged 4T (not 7T)", () => {
  const m = mk(); m.regs.a = 0x00; m.mem.write8(0x877b, 0xba);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2bc9 ? 4 : c);
  loc_2bbf(m); assert.notEqual(m.tstates, 65);
});