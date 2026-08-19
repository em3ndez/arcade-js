// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2cb3. Run: node --test .../loc_2cb3.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2cb3 } from "../loc_2cb3.js";

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

test("loc_2cb3 script 0x88 -> advance record state, queue display cmd; 194 T", () => {
  const m = mk(); m.regs.ix = 0x8ae0;
  m.mem.write8(0x8af6, 0x00); m.mem.write8(0x8af7, 0x90); m.mem.write8(0x9000, 0x88);
  loc_2cb3(m); assert.equal(m.tstates, 194, "T"); assert.deepEqual(m.calls, [0x4006, 0x381e]);
  assert.equal(m.mem.read8(0x8ae2), 0x01, "(ix+0x02) advanced");
});
test("loc_2cb3 script delta byte -> applies signed offset to position; 249 T", () => {
  const m = mk(); m.regs.ix = 0x8ae0;
  m.mem.write8(0x8af6, 0x00); m.mem.write8(0x8af7, 0x90); m.mem.write8(0x9000, 0x04);
  m.mem.write8(0x8af5, 0x00); m.mem.write8(0x8ae3, 0x10);
  loc_2cb3(m); assert.equal(m.tstates, 249, "T"); assert.deepEqual(m.calls, [0x4006]);
  assert.equal(m.mem.read8(0x8ae3), 0x0c, "(ix+0x03) -= delta (bit0 clear -> subtract)");
});
test("loc_2cb3 MUTATION: bit 0,(ix+0x15) mis-charged 16T (not 20T)", () => {
  const m = mk(); m.regs.ix = 0x8ae0;
  m.mem.write8(0x8af6, 0x00); m.mem.write8(0x8af7, 0x90); m.mem.write8(0x9000, 0x04);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2ce4 ? 16 : c);
  loc_2cb3(m); assert.notEqual(m.tstates, 249);
});