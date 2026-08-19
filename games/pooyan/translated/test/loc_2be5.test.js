// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2be5. Run: node --test .../loc_2be5.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2be5 } from "../loc_2be5.js";

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

test("loc_2be5 slot occupied -> ret c, returns true; 53 T", () => {
  const m = mk(); m.mem.write8(0x8a80, 0x01);
  const r = loc_2be5(m); assert.equal(r, true); assert.equal(m.tstates, 53, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2be5 free slot -> seed record + display cmd, pop af; ret returns false; 365 T", () => {
  const m = mk(); m.mem.write8(0x8a80, 0x00); m.mem.write8(0x8a81, 0x00); m.mem.write8(0x8903, 0x05);
  const r = loc_2be5(m); assert.equal(r, false); assert.equal(m.tstates, 365, "T"); assert.deepEqual(m.calls, [0x381e]);
  assert.equal(m.mem.read8(0x8a80), 0x01, "slot marked active");
  assert.equal(m.mem.read8(0x8a82), 0x11, "(ix+0x02) seeded");
});
test("loc_2be5 MUTATION: rrca mis-charged 8T (not 4T)", () => {
  const m = mk(); m.mem.write8(0x8a80, 0x01);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2bec ? 8 : c);
  loc_2be5(m); assert.notEqual(m.tstates, 53);
});