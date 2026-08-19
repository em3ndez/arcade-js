// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2d66. Run: node --test .../loc_2d66.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2d66 } from "../loc_2d66.js";

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

test("loc_2d66 (0x8d32) busy -> ret nz; 28 T", () => {
  const m = mk(); m.mem.write8(0x8d32, 0x01);
  loc_2d66(m); assert.equal(m.tstates, 28, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2d66 active -> run loc_2d78 + loc_2e22; 111 T", () => {
  const m = mk(); m.mem.write8(0x8d32, 0x00); m.mem.write8(0x8903, 0x05);
  loc_2d66(m); assert.equal(m.tstates, 111, "T"); assert.deepEqual(m.calls, [0x2d78, 0x2e22]);
});
test("loc_2d66 (0x8903)==2 -> ret z", () => {
  const m = mk(); m.mem.write8(0x8d32, 0x00); m.mem.write8(0x8903, 0x02);
  loc_2d66(m); assert.deepEqual(m.calls, []);
});
test("loc_2d66 MUTATION: sub 0x02 mis-charged 4T (not 7T)", () => {
  const m = mk(); m.mem.write8(0x8903, 0x05);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2d70 ? 4 : c);
  loc_2d66(m); assert.notEqual(m.tstates, 111);
});