// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2d80. Run: node --test .../loc_2d80.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Regs } from "../../../../core/cpu/z80.js";
import { loc_2d80 } from "../loc_2d80.js";

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

test("loc_2d80 counter caught up -> ret z; 48 T", () => {
  const m = mk(); m.mem.write8(0x8903, 0x03); m.mem.write8(0x8931, 0x01);
  loc_2d80(m); assert.equal(m.tstates, 48, "T"); assert.deepEqual(m.calls, []);
});
test("loc_2d80 extend -> bump counter, look up column, arm timers; 310 T", () => {
  const m = mk(); m.mem.write8(0x8903, 0x08); m.mem.write8(0x8931, 0x00); m.mem.write8(0x8f18, 0x02); m.mem.write8(0x89ef, 0x00);
  loc_2d80(m);
  assert.equal(m.tstates, 310, "T"); assert.deepEqual(m.calls, [0x0020]);
  assert.equal(m.mem.read8(0x8931), 0x01, "segment counter bumped");
  assert.equal(m.mem.read8(0x8f18), 0x03, "cell index advanced");
  assert.equal(m.mem.read8(0x8f16), 0x10, "sub-timer armed");
});
test("loc_2d80 MUTATION: ld (0x8f19),hl mis-charged 13T (not 16T)", () => {
  const m = mk(); m.mem.write8(0x8903, 0x08); m.mem.write8(0x8f18, 0x02); m.mem.write8(0x89ef, 0x01);
  const r = m.step.bind(m); m.step = (n, c) => r(n, n === 0x2da3 ? 13 : c);
  loc_2d80(m); assert.notEqual(m.tstates, 310);
});