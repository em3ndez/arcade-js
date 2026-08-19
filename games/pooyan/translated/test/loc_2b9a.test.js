// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2b9a. Run: node --test .../loc_2b9a.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2b9a } from "../loc_2b9a.js";

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

test("loc_2b9a countdown non-zero -> dec + ret; 83 T", () => {
  const m = mk(); m.mem.write8(0x8903, 0x05); m.mem.write8(0x8d30, 0x05);
  loc_2b9a(m); assert.equal(m.tstates, 83, "T"); assert.equal(m.pc, CR); assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8d30), 0x04, "0x8d30 decremented");
});
test("loc_2b9a countdown expired -> IX/DE seed + fall into loc_2bb3; 101 T", () => {
  const m = mk(); m.mem.write8(0x8903, 0x05); m.mem.write8(0x8d30, 0x00);
  loc_2b9a(m); assert.equal(m.tstates, 101, "T"); assert.deepEqual(m.calls, [0x2bb3]);
  assert.equal(m.regs.ix, 0x8c60); assert.equal(m.regs.de, 0xffe8);
});
test("loc_2b9a (0x8903)<2 -> conditionally calls caller-skip loc_2bbf", () => {
  const m = mk(); m.mem.write8(0x8903, 0x01); m.mem.write8(0x8d30, 0x05);
  loc_2b9a(m); assert.deepEqual(m.calls, [0x2bbf], "call c taken");
});
test("loc_2b9a loc_2bbf caller-skip -> loc_2b9a aborts", () => {
  const m = mk(); m.skip.add(0x2bbf); m.mem.write8(0x8903, 0x01);
  loc_2b9a(m); assert.deepEqual(m.calls, [0x2bbf]); assert.equal(m.pc, CR, "aborted to caller");
});